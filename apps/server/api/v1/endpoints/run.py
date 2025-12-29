from typing import Optional

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from db.session import get_db
from services.deployment_service import DeploymentService

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
    # 인증 토큰 추출
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif x_auth_secret:  # [DEV] 테스트용
        auth_token = x_auth_secret

    # DeploymentService를 통해 실행
    return DeploymentService.run_deployment(
        db=db,
        url_slug=url_slug,
        user_inputs=request_body.get("inputs", {}),
        auth_token=auth_token,
    )
