"""
템플릿 위저드 API 엔드포인트.

사용자의 Jinja2 템플릿을 AI가 개선해주는 기능을 제공합니다.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.template_wizard_service import (
    check_credentials as check_template_wizard_credentials,
)
from apps.gateway.services.template_wizard_service import (
    improve_template as improve_template_service,
)
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db

router = APIRouter()


class TemplateImproveRequest(BaseModel):
    """템플릿 개선 요청"""

    template_type: Literal["email", "message", "report", "custom"]
    original_template: str
    registered_variables: List[str] = []
    custom_instructions: Optional[str] = None


class TemplateImproveResponse(BaseModel):
    """템플릿 개선 응답"""

    improved_template: str


class CredentialCheckResponse(BaseModel):
    """Credential 확인 응답"""

    has_credentials: bool


@router.get("/check-credentials", response_model=CredentialCheckResponse)
def check_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    현재 사용자가 유효한 LLM credential을 가지고 있는지 확인합니다.
    """
    return {"has_credentials": check_template_wizard_credentials(db, current_user)}


@router.post("/improve", response_model=TemplateImproveResponse)
async def improve_template(
    request: TemplateImproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 Jinja2 템플릿을 개선합니다.

    사용자의 등록된 LLM credential을 사용하여 템플릿 개선을 수행합니다.
    원본 템플릿에 있던 변수만 보존합니다.
    """
    improved_template = await improve_template_service(
        template_type=request.template_type,
        original_template=request.original_template,
        registered_variables=request.registered_variables,
        custom_instructions=request.custom_instructions,
        db=db,
        current_user=current_user,
    )
    return {"improved_template": improved_template}
