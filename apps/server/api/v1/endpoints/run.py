from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from db.models.workflow_deployment import WorkflowDeployment
from db.session import get_db
from workflow.core.workflow_engine import WorkflowEngine

router = APIRouter()


@router.post("/run/{url_slug}")
def run_workflow(
    url_slug: str,
    request_body: dict = {},
    authorization: Optional[str] = Header(None),
    x_auth_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """
    배포된 워크플로우를 URL Slug로 실행합니다.
    - url_slug: workflow_deployments 생성시 만들어진 고유 주소
    """

    # url_slug와 일치하는 배포 찾기
    deployment = (
        db.query(WorkflowDeployment)
        .filter(WorkflowDeployment.url_slug == url_slug)
        .first()
    )

    # 존재여부 및 활성상태 체크
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found.")

    if not deployment.is_active:
        raise HTTPException(status_code=404, detail="Deployment is inactive")

    # 인증 검증 (공개배포가 아닐 경우만)
    if deployment.auth_secret:
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        elif x_auth_secret:  # [DEV] 테스트용
            token = x_auth_secret

        if token != deployment.auth_secret:
            raise HTTPException(status_code=401, detail="Invalid authentication secret")

    # 그래프 데이터 준비
    graph_data = deployment.graph_snapshot

    # 워크플로우 실행 요청
    try:
        engine = WorkflowEngine(
            graph=graph_data, user_input=request_body.get("inputs", {})
        )

        # 실행 (동기방식)
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
