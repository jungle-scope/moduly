from fastapi import APIRouter, HTTPException

from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


@router.post("/run")
def run_workflow(request_body: dict):
    # 1. 데이터 준비
    # DB에서 저장된 그래프(snapshot)를 가져오거나 요청 바디에서 받음
    graph_data = request_body.get("graph")
    user_inputs = request_body.get("inputs", {})
    try:
        # 2. 엔진 초기화
        # 받은 데이터(graph_data)를 그대로 엔진에 주입
        engine = WorkflowEngine(graph=graph_data, user_input=user_inputs)
        # 3. 워크플로우 실행
        # 이 함수는 동기(Sync)로 실행되므로 모든 노드 처리가 끝날 때까지 대기합니다.
        results = engine.execute()
        # 4. 결과 반환
        return {"status": "success", "results": results}
    except ValueError as e:
        # 엔진이 유효성 검사(StartNode 없음 등) 중 발생시킨 에러
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        # 지원하지 않는 노드 타입이 포함된 경우
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        # 실행 중 발생한 기타 런타임 에러
        raise HTTPException(
            status_code=500, detail=f"Engine execution failed: {str(e)}"
        )
