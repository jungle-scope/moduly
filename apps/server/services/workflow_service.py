from sqlalchemy.orm import Session

from db.models.workflow import Workflow
from schemas.workflow import WorkflowDraftRequest


class WorkflowService:
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

        if not workflow:
            # 새 워크플로우 생성
            workflow = Workflow(
                id=workflow_id,
                tenant_id="default-tenant",
                app_id="default-app",
                created_by=user_id,
            )
            db.add(workflow)

        # Graph 데이터 저장 (JSONB 형식)
        workflow.graph = {
            "nodes": [node.model_dump() for node in request.nodes],
            "edges": [edge.model_dump() for edge in request.edges],
            "viewport": request.viewport.model_dump() if request.viewport else None,
        }

        # 업데이트 정보
        workflow.updated_by = user_id

        # DB에 커밋
        db.commit()
        db.refresh(workflow)

        print("=== [Backend] Workflow Saved to DB ===")
        print(f"Workflow ID: {workflow_id}")
        print(f"Nodes count: {len(request.nodes)}")
        print(f"Edges count: {len(request.edges)}")

        return {
            "status": "success",
            "message": "Draft saved to PostgreSQL",
            "workflow_id": workflow_id,
        }
