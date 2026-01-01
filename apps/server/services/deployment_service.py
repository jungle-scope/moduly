"""Deployment Service - 배포 관련 비즈니스 로직"""

import secrets
import uuid
from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow import Workflow
from db.models.workflow_deployment import DeploymentType, WorkflowDeployment
from schemas.deployment import DeploymentCreate
from services.workflow_service import WorkflowService
from workflow.core.workflow_engine import WorkflowEngine


class DeploymentService:
    """배포 관련 비즈니스 로직을 담당하는 Service"""

    @staticmethod
    def create_deployment(
        db: Session, deployment_in: DeploymentCreate, user_id: uuid.UUID
    ) -> WorkflowDeployment:
        """
        워크플로우를 배포합니다.

        Args:
            db: 데이터베이스 세션
            deployment_in: 배포 생성 요청 데이터
            user_id: 현재 사용자 ID

        Returns:
            생성된 WorkflowDeployment 객체

        Raises:
            HTTPException: 워크플로우를 찾을 수 없거나 권한이 없는 경우
        """
        # 1. 워크플로우 존재 확인
        workflow = (
            db.query(Workflow).filter(Workflow.id == deployment_in.workflow_id).first()
        )
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # 2. 권한 체크 (내 워크플로우인지)
        if workflow.created_by != str(user_id):
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to deploy this workflow.",
            )

        # 2.5. App 조회 및 첫 배포 시 url_slug, auth_secret 생성
        app = db.query(App).filter(App.id == workflow.app_id).first()
        if app:
            if not app.url_slug:
                # AppService의 헬퍼 함수 사용
                from services.app_service import AppService

                app.url_slug = AppService._generate_url_slug(db, app.name)

            if not app.auth_secret:
                app.auth_secret = secrets.token_urlsafe(32)

            db.flush()

        # 3. Draft 데이터(Snapshot) 가져오기
        graph_snapshot = deployment_in.graph_snapshot
        if not graph_snapshot:
            graph_snapshot = WorkflowService.get_draft(db, deployment_in.workflow_id)

        if not graph_snapshot:
            raise HTTPException(
                status_code=400,
                detail="Cannot deploy workflow without graph data. Please save the workflow first.",
            )

        # 4. 버전 번호 채번
        max_version = (
            db.query(func.max(WorkflowDeployment.version))
            .filter(WorkflowDeployment.workflow_id == deployment_in.workflow_id)
            .scalar()
        ) or 0
        new_version = max_version + 1

        # 5. API Key (auth_secret) 및 URL Slug 생성
        auth_secret = deployment_in.auth_secret

        # 배포 타입에 따라 auth_secret 처리
        if deployment_in.type in [DeploymentType.WEBAPP, DeploymentType.WIDGET]:
            # 웹 앱 및 위젯은 무조건 공개 접근 (auth_secret 없음)
            auth_secret = None
        elif not auth_secret:
            # REST API 등은 자동 생성 (auth_secret이 제공되지 않은 경우)
            auth_secret = f"sk-{secrets.token_hex(24)}"
        # else: auth_secret이 명시적으로 제공된 경우 그대로 사용

        url_slug = deployment_in.url_slug
        if not url_slug:
            url_slug = f"v{new_version}-{secrets.token_hex(4)}"

        # 6. graph_snapshot에서 입출력 스키마 자동 추출
        input_schema = DeploymentService._extract_input_schema(graph_snapshot)
        output_schema = DeploymentService._extract_output_schema(graph_snapshot)

        # 7. 배포 모델 생성
        db_obj = WorkflowDeployment(
            workflow_id=deployment_in.workflow_id,
            version=new_version,
            type=deployment_in.type,
            url_slug=url_slug,
            auth_secret=auth_secret,
            graph_snapshot=graph_snapshot,
            config=deployment_in.config,
            input_schema=input_schema,  # 추출된 입력 스키마
            output_schema=output_schema,  # 추출된 출력 스키마
            description=deployment_in.description,
            created_by=user_id,
            is_active=deployment_in.is_active,
        )

        try:
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

        return db_obj

    @staticmethod
    def list_deployments(
        db: Session, workflow_id: str, skip: int = 0, limit: int = 100
    ) -> List[WorkflowDeployment]:
        """
        특정 워크플로우의 배포 이력을 조회합니다.

        Args:
            db: 데이터베이스 세션
            workflow_id: 워크플로우 ID
            skip: 페이지네이션 시작 위치
            limit: 조회할 최대 개수

        Returns:
            WorkflowDeployment 객체 리스트
        """
        deployments = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.workflow_id == workflow_id)
            .order_by(desc(WorkflowDeployment.version))
            .offset(skip)
            .limit(limit)
            .all()
        )
        return deployments

    @staticmethod
    def get_deployment(db: Session, deployment_id: str) -> WorkflowDeployment:
        """
        특정 배포 ID의 상세 정보를 조회합니다.

        Args:
            db: 데이터베이스 세션
            deployment_id: 배포 ID

        Returns:
            WorkflowDeployment 객체

        Raises:
            HTTPException: 배포를 찾을 수 없는 경우
        """
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")

        return deployment

    @staticmethod
    def run_deployment(
        db: Session,
        url_slug: str,
        user_inputs: Dict[str, Any],
        auth_token: Optional[str] = None,
        require_auth: bool = True,  # 인증 필요 여부 (기본값: 필요)
    ) -> Dict[str, Any]:
        """
        배포된 워크플로우를 실행합니다.

        Args:
            db: 데이터베이스 세션
            url_slug: 배포 URL slug (예: "v3-24fb1145")
            user_inputs: 워크플로우 실행 시 사용자 입력 데이터
            auth_token: 인증 토큰 (Bearer 토큰 또는 API secret)
            require_auth: 인증 검증 필요 여부 (True: REST API, False: 웹 앱)

        Returns:
            워크플로우 실행 결과 {"status": "success", "results": {...}}

        Raises:
            HTTPException: 배포를 찾을 수 없거나 권한이 없거나 실행 실패 시
        """
        # 1. url_slug와 일치하는 배포 찾기
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.url_slug == url_slug)
            .first()
        )

        # 2. 존재여부 체크
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found.")

        # 3. 활성상태 체크
        if not deployment.is_active:
            raise HTTPException(status_code=404, detail="Deployment is inactive")

        # 4. 인증 검증
        # 배포 타입에 따른 인증 검증
        if (
            deployment.type == DeploymentType.WEBAPP
            or deployment.type == DeploymentType.WIDGET
        ):
            # 웹 앱 및 위젯: 공개 접근 허용 (require_auth는 이미 False)
            pass
        elif require_auth:
            # 인증이 필요한 경우 (REST API 등)
            if not deployment.auth_secret:
                raise HTTPException(
                    status_code=500,
                    detail="Deployment has no auth_secret but requires authentication",
                )
            if not auth_token or auth_token != deployment.auth_secret:
                raise HTTPException(
                    status_code=401, detail="Invalid authentication secret"
                )
        # require_auth가 False면 인증 스킵

        # 5. 그래프 데이터 준비
        graph_data = deployment.graph_snapshot

        # 6. 워크플로우 실행
        try:
            engine = WorkflowEngine(
                graph=graph_data, user_input=user_inputs, is_deployed=True
            )
            results = engine.execute()
            return {"status": "success", "results": results}

        except ValueError as e:
            # 필수 노드 누락 등 검증 에러
            raise HTTPException(status_code=400, detail=str(e))

        except NotImplementedError as e:
            # 지원하지 않는 기능 에러
            raise HTTPException(status_code=501, detail=str(e))

        except Exception as e:
            # 기타 서버 에러
            raise HTTPException(
                status_code=500, detail=f"Engine Execution failed: {str(e)}"
            )

    @staticmethod
    def _extract_input_schema(graph_snapshot: dict) -> dict | None:
        """
        graph_snapshot에서 StartNode의 입력 변수 스키마를 추출합니다.

        Returns:
            {
                "variables": [
                    {"name": "question", "type": "string", "label": "질문"},
                    ...
                ]
            }
        """
        if not graph_snapshot or not graph_snapshot.get("nodes"):
            return None

        for node in graph_snapshot["nodes"]:
            if node.get("type") == "startNode":
                variables = node.get("data", {}).get("variables", [])
                if not variables:
                    return None

                return {
                    "variables": [
                        {
                            "name": var.get("name", ""),
                            "type": var.get("type", "string"),
                            "label": var.get("label", var.get("name", "")),
                        }
                        for var in variables
                        if var.get("name")
                    ]
                }

        return None

    @staticmethod
    def _extract_output_schema(graph_snapshot: dict) -> dict | None:
        """
        graph_snapshot에서 AnswerNode의 출력 스키마를 추출합니다.

        Returns:
            {
                "outputs": [
                    {"variable": "result", "label": "결과"},
                    ...
                ]
            }
        """
        if not graph_snapshot or not graph_snapshot.get("nodes"):
            return None

        for node in graph_snapshot["nodes"]:
            if node.get("type") == "answerNode":
                outputs = node.get("data", {}).get("outputs", [])
                if not outputs:
                    return None

                return {
                    "outputs": [
                        {
                            "variable": output.get("variable", ""),
                            "label": output.get("label", output.get("variable", "")),
                        }
                        for output in outputs
                        if output.get("variable")
                    ]
                }

        return None
