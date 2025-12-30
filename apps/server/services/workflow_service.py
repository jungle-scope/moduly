from fastapi import HTTPException
from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow import Workflow
from schemas.workflow import WorkflowCreateRequest, WorkflowDraftRequest


class WorkflowService:
    @staticmethod
    def create_workflow(
        db: Session,
        request: WorkflowCreateRequest,
        user_id: str,
    ) -> Workflow:
        """
        새 워크플로우 생성

        Args:
            db: 데이터베이스 세션
            request: 워크플로우 생성 요청 (app_id, name, description)
            user_id: 생성자 ID

        Returns:
            생성된 Workflow 객체
        """
        # 앱 존재 확인 및 권한 체크
        app = db.query(App).filter(App.id == request.app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        if app.created_by != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        # 새 워크플로우 생성
        workflow = Workflow(
            tenant_id=user_id,
            app_id=request.app_id,
            created_by=user_id,
            marked_name=request.name,
            marked_comment=request.description,
            graph={
                "nodes": [],
                "edges": [],
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            },
        )

        db.add(workflow)
        db.commit()
        db.refresh(workflow)

        return workflow

    @staticmethod
    def save_draft(
        db: Session,
        workflow_id: str,
        request: WorkflowDraftRequest,
        user_id: str = "default-user",
    ):
        """
        워크플로우 초안을 PostgreSQL에 저장합니다.

        Args:
            db: 데이터베이스 세션
            workflow_id: 워크플로우 ID
            request: 워크플로우 데이터 (노드, 엣지, 뷰포트)
            user_id: 사용자 ID

        Returns:
            저장된 Workflow 객체
        """
        # 기존 워크플로우 찾기
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

        # workflow 없으면 error 반환
        if not workflow:
            raise HTTPException(
                status_code=404,  # "찾을 수 없음" (에러 종류)
                detail="Workflow not found",  # 상세 메시지
            )

        # Graph 데이터 저장 (JSONB 형식)
        workflow.graph = {
            "nodes": [node.model_dump() for node in request.nodes],
            "edges": [edge.model_dump() for edge in request.edges],
            "viewport": request.viewport.model_dump() if request.viewport else None,
        }

        workflow._features = request.features if request.features else {}

        # 환경 변수 처리: 요청에 환경 변수가 있으면 딕셔너리 형태로 변환하여 저장, 없으면 빈 리스트 저장
        workflow._environment_variables = (
            [v.model_dump() for v in request.environment_variables]
            if request.environment_variables
            else []
        )
        # 대화 변수 처리: 요청에 대화 변수가 있으면 딕셔너리 형태로 변환하여 저장, 없으면 빈 리스트 저장
        workflow._conversation_variables = (
            [v.model_dump() for v in request.conversation_variables]
            if request.conversation_variables
            else []
        )
        workflow.updated_by = user_id

        # DB에 커밋
        db.commit()
        db.refresh(workflow)

        return {
            "status": "success",
            "message": "Draft saved to PostgreSQL",
            "workflow_id": workflow_id,
        }

    @staticmethod
    def get_draft(db: Session, workflow_id: str):
        """
        워크플로우 초안을 PostgreSQL에서 조회합니다.
        """
        # db.query(...).first()는 조건에 맞는 첫 번째 행을 'Workflow' 모델 인스턴스(객체)로 반환합니다.
        # 데이터가 없으면 None을 반환합니다.
        workflow = db.query(Workflow).filter(Workflow.id == workflow_id).first()

        if not workflow:
            return None

        # workflow.graph는 DB의 JSONB 타입 컬럼이며, 파이썬에서는 딕셔너리(dict)로 변환되어 반환됩니다.
        # 구조 예시: {"nodes": [...], "edges": [...], "viewport": {...}}
        # 이 데이터는 WorkflowEngine의 초기화 인자로 전달되어 실행에 사용됩니다.
        data = workflow.graph if workflow.graph else {}

        if workflow._features:
            data["features"] = workflow._features

        return data
