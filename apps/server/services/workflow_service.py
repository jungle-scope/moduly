from schemas.workflow import WorkflowDraftRequest

class WorkflowService:
    @staticmethod
    def save_draft(request: WorkflowDraftRequest):
        """
        워크플로우 초안을 저장합니다.
        현재는 콘솔에 출력하는 것으로 대체합니다.
        실제 구현 시 DB에 저장하는 로직이 들어갑니다.
        """
        print("=== [Backend] Saving Draft Workflow ===")
        print(f"Nodes count: {len(request.nodes)}")
        print(f"Edges count: {len(request.edges)}")
        
        # 여기에 DB 저장 로직 구현 (예: Workflow 모델 생성 및 저장)
        # data = request.model_dump()
        # db.add(Workflow(**data))
        # db.commit()

        return {"status": "success", "message": "Draft saved successfully (Mock)"}
