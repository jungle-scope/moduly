"""Deployment Service - 배포 관련 비즈니스 로직"""

import secrets
import uuid
from typing import Any, Dict, List, Optional

from apps.shared.celery_app import celery_app
from apps.shared.db.models.app import App
from apps.shared.db.models.schedule import Schedule
from apps.shared.db.models.workflow import Workflow
from apps.shared.db.models.workflow_deployment import DeploymentType, WorkflowDeployment
from apps.shared.schemas.deployment import DeploymentCreate
from fastapi import HTTPException
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from services.workflow_service import WorkflowService


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
        # 1. App 조회 및 권한 확인
        app = db.query(App).filter(App.id == deployment_in.app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        # 2. 권한 체크
        if app.created_by != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to deploy this app.",
            )

        # 3. Workflow 조회 (app의 작업실)
        workflow = db.query(Workflow).filter(Workflow.id == app.workflow_id).first()
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # 4. 첫 배포 시 url_slug, auth_secret 생성
        if not app.url_slug:
            from services.app_service import AppService

            app.url_slug = AppService._generate_url_slug(db, app.name)

        if not app.auth_secret:
            app.auth_secret = secrets.token_urlsafe(32)

        db.flush()

        # 5. Draft 데이터(Snapshot) 가져오기
        graph_snapshot = deployment_in.graph_snapshot
        if not graph_snapshot:
            graph_snapshot = WorkflowService.get_draft(db, str(workflow.id))

        if not graph_snapshot:
            raise HTTPException(
                status_code=400,
                detail="Cannot deploy workflow without graph data. Please save the workflow first.",
            )

        # 6. 버전 번호 채번 (app_id 기준)
        max_version = (
            db.query(func.max(WorkflowDeployment.version))
            .filter(WorkflowDeployment.app_id == deployment_in.app_id)
            .scalar()
        ) or 0
        new_version = max_version + 1

        # 7. 입출력 스키마 자동 추출
        input_schema = DeploymentService._extract_input_schema(graph_snapshot)
        output_schema = DeploymentService._extract_output_schema(graph_snapshot)

        # 8. 배포 모델 생성
        db_obj = WorkflowDeployment(
            app_id=deployment_in.app_id,
            version=new_version,
            type=deployment_in.type,
            # url_slug, auth_secret 제거 (App 모델에서 관리)
            graph_snapshot=graph_snapshot,
            config=deployment_in.config,
            input_schema=input_schema,
            output_schema=output_schema,
            description=deployment_in.description,
            created_by=user_id,
            is_active=deployment_in.is_active,
        )

        try:
            db.add(db_obj)
            db.flush()

            # 8.1. 같은 앱의 기존 배포를 모두 비활성화 (단일 활성화 정책)
            if db_obj.is_active:
                from services.scheduler_service import get_scheduler_service

                scheduler_service = get_scheduler_service()
                DeploymentService._deactivate_other_deployments(
                    db, app.id, db_obj.id, scheduler_service
                )

            # 9. App의 active_deployment_id 업데이트
            app.active_deployment_id = db_obj.id

            # 10. ScheduleTrigger 노드가 있으면 스케줄 생성
            schedule_trigger_node = DeploymentService._find_schedule_trigger_node(
                graph_snapshot
            )
            if schedule_trigger_node:
                from services.scheduler_service import get_scheduler_service

                # Schedule 레코드 생성
                schedule = Schedule(
                    deployment_id=db_obj.id,
                    node_id=schedule_trigger_node["id"],
                    cron_expression=schedule_trigger_node["data"]["cron_expression"],
                    timezone=schedule_trigger_node["data"].get("timezone", "UTC"),
                )
                db.add(schedule)
                db.flush()

                # APScheduler에 등록
                try:
                    scheduler_service = get_scheduler_service()
                    scheduler_service.add_schedule(schedule, db)
                    print(
                        f"[Deployment] ✓ 스케줄 생성 완료: {schedule.id} | {schedule.cron_expression}"
                    )
                except Exception as e:
                    print(f"[Deployment] ✗ 스케줄 등록 실패: {e}")
                    # 스케줄 등록 실패해도 배포는 성공으로 처리
                    # (나중에 수동으로 재등록 가능)

            db.commit()
            db.refresh(db_obj)

            # 응답 객체에 App의 url_slug와 auth_secret 주입 (프론트엔드 표시용)
            # 모델에는 없지만 Pydantic response schema에는 존재함
            db_obj.url_slug = app.url_slug
            db_obj.auth_secret = app.auth_secret

            return db_obj

        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e))

    @staticmethod
    def list_deployments(
        db: Session,
        app_id: uuid.UUID = None,
        workflow_id: uuid.UUID = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[WorkflowDeployment]:
        """
        특정 앱의 배포 이력을 조회합니다.

        Args:
            db: 데이터베이스 세션
            user_id: 요청 사용자 ID (권한 확인용)
            app_id: 앱 ID (Optional)
            workflow_id: 워크플로우 ID (Optional)
            skip: 페이지네이션 시작 위치
            limit: 조회할 최대 개수

        Returns:
            WorkflowDeployment 객체 리스트

        Raises:
            HTTPException: 권한이 없는 경우
        """
        if workflow_id and not app_id:
            # workflow_id로 app_id 찾기
            app = db.query(App).filter(App.workflow_id == workflow_id).first()
            if app:
                app_id = app.id

        if not app_id:
            return []

        # [SECURE] App 조회
        app = db.query(App).filter(App.id == app_id).first()
        if not app:
            # 앱이 없으면 빈 리스트 반환하거나 404 (여기선 빈 리스트 유지)
            return []

        deployments = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.app_id == app_id)
            .order_by(desc(WorkflowDeployment.version))
            .offset(skip)
            .limit(limit)
            .all()
        )

        return deployments

    @staticmethod
    def get_deployment(db: Session, deployment_id: uuid.UUID) -> WorkflowDeployment:
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
    def list_workflow_node_deployments(
        db: Session, user_id: uuid.UUID, excluded_app_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        '워크플로우 노드'로 배포된 모든 앱의 목록을 조회합니다.
        다른 워크플로우에서 사용할 수 있는 컴포넌트 목록용입니다.

        Returns:
            [
                {
                    "deployment_id": "...",
                    "app_id": "...",
                    "name": "...",
                    "description": "...",
                    "input_schema": {...},
                    "output_schema": {...},
                    "version": 1
                }, ...
            ]
        """
        # 1. 활성 배포(Active Deployment)가 있고, 타입이 WORKFLOW_NODE인 App 조회
        # (WorkflowDeployment와 App을 조인하여 최신 정보 가져옴)
        query = (
            db.query(App, WorkflowDeployment)
            .join(WorkflowDeployment, App.active_deployment_id == WorkflowDeployment.id)
            .filter(WorkflowDeployment.type == DeploymentType.WORKFLOW_NODE)
            .filter(WorkflowDeployment.is_active == True)
            .filter(App.created_by == user_id)  # [NEW] 내 앱만 조회
        )

        if excluded_app_id:
            query = query.filter(App.id != excluded_app_id)

        results = query.all()

        nodes = []
        for app, deployment in results:
            nodes.append(
                {
                    "deployment_id": str(deployment.id),
                    "app_id": str(app.id),
                    "name": app.name,
                    "description": app.description,
                    "input_schema": deployment.input_schema,
                    "output_schema": deployment.output_schema,
                    "version": deployment.version,
                }
            )

        return nodes

    @staticmethod
    async def run_deployment(
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
            url_slug: 앱의 URL slug (예: "my-chat-app")
            user_inputs: 워크플로우 실행 시 사용자 입력 데이터
            auth_token: 인증 토큰 (Bearer 토큰 또는 API secret) - App의 auth_secret과 비교
            require_auth: 인증 검증 필요 여부 (True: REST API, False: 웹 앱)

        Returns:
            워크플로우 실행 결과 {"status": "success", "results": {...}}

        Raises:
            HTTPException: 배포를 찾을 수 없거나 권한이 없거나 실행 실패 시
        """
        # 1. url_slug와 일치하는 App 찾기 (App 중심 구조)
        app = db.query(App).filter(App.url_slug == url_slug).first()
        if not app:
            raise HTTPException(status_code=404, detail="App not found.")

        # 2. 활성 배포(Active Deployment) 조회
        if not app.active_deployment_id:
            raise HTTPException(
                status_code=404, detail="No active deployment found for this app."
            )

        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == app.active_deployment_id)
            .first()
        )

        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment data not found.")

        # 3. 활성상태 체크
        if not deployment.is_active:
            raise HTTPException(status_code=404, detail="Deployment is inactive")

        # 4. 인증 검증 (App의 auth_secret 사용)
        # 배포 타입에 따른 인증 검증
        if (
            deployment.type == DeploymentType.WEBAPP
            or deployment.type == DeploymentType.WIDGET
        ):
            # 웹 앱 및 위젯: 공개 접근 허용 (require_auth는 이미 False)
            pass
        elif require_auth:
            # 인증이 필요한 경우 (REST API 등)
            if not app.auth_secret:
                raise HTTPException(
                    status_code=500,
                    detail="App has no auth_secret but requires authentication",
                )
            if not auth_token or auth_token != app.auth_secret:
                raise HTTPException(
                    status_code=401, detail="Invalid authentication secret"
                )
        # require_auth가 False면 인증 스킵

        # 5. 그래프 데이터 준비
        graph_data = deployment.graph_snapshot

        # 6. 워크플로우 실행 (Celery 태스크로 위임)
        try:
            # [NEW] 로깅을 위한 컨텍스트 주입
            execution_context = {
                "user_id": str(app.created_by),  # UUID를 문자열로 변환 (JSON 직렬화)
                "workflow_id": str(app.workflow_id) if app.workflow_id else None,
                "trigger_mode": "app",  # [NEW] 실행 모드 (앱 배포 실행)
                "deployment_id": str(deployment.id),
                "workflow_version": deployment.version,
            }

            # Celery 태스크 호출 (workflow.execute)
            task = celery_app.send_task(
                "workflow.execute",
                args=[graph_data, user_inputs, execution_context],
                kwargs={"is_deployed": True},
            )

            # 결과 대기 (타임아웃 10분)
            result = task.get(timeout=600)

            if result.get("status") == "success":
                return {"status": "success", "results": result.get("result", {})}
            else:
                raise HTTPException(status_code=500, detail="Workflow execution failed")

        except celery_app.backend.TimeoutError:
            raise HTTPException(status_code=504, detail="Workflow execution timed out")

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
            elif node.get("type") == "webhookTrigger":
                mappings = node.get("data", {}).get("variable_mappings", [])
                if not mappings:
                    return None

                return {
                    "variables": [
                        {
                            # Webhook의 변수는 모두 string으로 취급하거나,
                            # 필요하면 JSON Path에서 유추해야 하지만 일단 string으로 통일
                            "name": mapping.get("variable_name", ""),
                            "type": "string",
                            "label": mapping.get("variable_name", ""),
                        }
                        for mapping in mappings
                        if mapping.get("variable_name")
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

    @staticmethod
    def _find_schedule_trigger_node(graph_snapshot: dict) -> dict | None:
        """
        graph_snapshot에서 ScheduleTrigger 노드를 찾습니다.

        Returns:
            ScheduleTrigger 노드 객체 또는 None
        """
        if not graph_snapshot or not graph_snapshot.get("nodes"):
            return None

        for node in graph_snapshot["nodes"]:
            if node.get("type") == "scheduleTrigger":
                return node

        return None

    @staticmethod
    def _deactivate_other_deployments(
        db: Session,
        app_id: uuid.UUID,
        current_deployment_id: uuid.UUID,
        scheduler_service=None,
    ):
        """
        같은 앱의 다른 활성 배포들을 모두 비활성화, 핼퍼 함수로 사용

        Args:
            db: 데이터베이스 세션
            app_id: 앱 ID
            current_deployment_id: 현재 배포 ID (제외할 배포)
            scheduler_service: SchedulerService 인스턴스
        """
        other_deployments = (
            db.query(WorkflowDeployment)
            .filter(
                WorkflowDeployment.app_id == app_id,
                WorkflowDeployment.id != current_deployment_id,
                WorkflowDeployment.is_active.is_(True),
            )
            .all()
        )

        for other in other_deployments:
            other.is_active = False

            # Schedule Job 제거
            other_schedule = (
                db.query(Schedule).filter(Schedule.deployment_id == other.id).first()
            )
            if other_schedule and scheduler_service:
                try:
                    scheduler_service.remove_schedule(other_schedule.id)
                except Exception as e:
                    print(f"[Deployment] ✗ 스케줄 제거 실패: {e}")

    @staticmethod
    def toggle_deployment(
        db: Session, deployment_id: uuid.UUID, scheduler_service=None
    ) -> WorkflowDeployment:
        """
        배포의 is_active 상태를 토글합니다.

        활성화 시: 같은 앱의 다른 모든 배포를 비활성화합니다 (단일 활성화 정책)

        Args:
            db: 데이터베이스 세션
            deployment_id: 배포 ID
            scheduler_service: SchedulerService 인스턴스 (스케줄 관리용)

        Returns:
            업데이트된 WorkflowDeployment 객체

        Raises:
            HTTPException: 배포를 찾을 수 없는 경우
        """
        # 1. 배포 조회
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")

        # 2. is_active 토글
        new_state = not deployment.is_active
        deployment.is_active = new_state

        # 3. 활성화하는 경우: 같은 앱의 다른 배포를 모두 비활성화
        if new_state:
            DeploymentService._deactivate_other_deployments(
                db, deployment.app_id, deployment_id, scheduler_service
            )

        # 3.1. App의 active_deployment_id 동기화
        app = db.query(App).filter(App.id == deployment.app_id).first()
        if app:
            if new_state:
                app.active_deployment_id = deployment.id
            elif app.active_deployment_id == deployment.id:
                app.active_deployment_id = None

        # 4. 현재 배포의 Schedule 처리
        schedule = (
            db.query(Schedule).filter(Schedule.deployment_id == deployment_id).first()
        )

        if schedule and scheduler_service:
            if deployment.is_active:
                # 활성화: Schedule Job 재등록
                scheduler_service.add_schedule(schedule, db)
            else:
                # 비활성화: Schedule Job 제거
                scheduler_service.remove_schedule(schedule.id)

        db.commit()
        db.refresh(deployment)

        return deployment

    @staticmethod
    def delete_deployment(
        db: Session, deployment_id: uuid.UUID, scheduler_service=None
    ) -> Dict[str, str]:
        """
        배포를 삭제합니다.

        Args:
            db: 데이터베이스 세션
            deployment_id: 배포 ID
            scheduler_service: SchedulerService 인스턴스 (스케줄 관리용)

        Returns:
            삭제 결과 메시지

        Raises:
            HTTPException: 배포를 찾을 수 없는 경우
        """
        # 1. 배포 조회
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")

        # 2. Schedule 제거
        schedule = (
            db.query(Schedule).filter(Schedule.deployment_id == deployment_id).first()
        )
        if schedule:
            if scheduler_service:
                scheduler_service.remove_schedule(schedule.id)
            db.delete(schedule)

        # 3. App의 active_deployment_id 업데이트
        app = db.query(App).filter(App.id == deployment.app_id).first()
        if app and app.active_deployment_id == deployment_id:
            # 다른 활성 배포 찾기 (최신 버전 우선)
            other_deployment = (
                db.query(WorkflowDeployment)
                .filter(
                    WorkflowDeployment.app_id == app.id,
                    WorkflowDeployment.id != deployment_id,
                    WorkflowDeployment.is_active == True,
                )
                .order_by(WorkflowDeployment.version.desc())
                .first()
            )

            app.active_deployment_id = other_deployment.id if other_deployment else None

        # 4. 배포 레코드 삭제
        db.delete(deployment)
        db.commit()

        return {"message": f"Deployment {deployment_id} deleted successfully"}
