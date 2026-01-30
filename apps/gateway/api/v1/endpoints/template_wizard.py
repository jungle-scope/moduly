"""
템플릿 위저드 API 엔드포인트.

사용자의 Jinja2 템플릿을 AI가 개선해주는 기능을 제공합니다.
핵심: 기존 변수({{ ... }})를 보존하면서 템플릿 품질을 향상시킵니다.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.wizard import WizardService
from apps.shared.db.models.llm import LLMCredential
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db

router = APIRouter()


# === Request/Response Schemas ===


class TemplateImproveRequest(BaseModel):
    """템플릿 개선 요청"""

    template_type: Literal["email", "message", "report", "custom"]
    original_template: str
    registered_variables: List[str] = []  # 예: ["user_name", "order_id"]
    custom_instructions: Optional[str] = None  # custom 타입일 때 사용


class TemplateImproveResponse(BaseModel):
    """템플릿 개선 응답"""

    improved_template: str


class CredentialCheckResponse(BaseModel):
    """Credential 확인 응답"""

    has_credentials: bool


# === Endpoints ===


@router.get("/check-credentials", response_model=CredentialCheckResponse)
def check_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    현재 사용자가 유효한 LLM credential을 가지고 있는지 확인합니다.
    """
    credential = (
        db.query(LLMCredential)
        .filter(LLMCredential.user_id == current_user.id, LLMCredential.is_valid)
        .first()
    )

    return {"has_credentials": credential is not None}


@router.post("/improve", response_model=TemplateImproveResponse)
async def improve_template(
    request: TemplateImproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 Jinja2 템플릿을 개선합니다.

    사용자의 등록된 LLM credential을 사용하여 템플릿 개선을 수행합니다.
    등록된 변수는 반드시 보존됩니다.
    """
    improved_template = await WizardService.improve_template(
        db,
        current_user.id,
        request.template_type,
        request.original_template,
        request.registered_variables,
        request.custom_instructions,
    )
    return {"improved_template": improved_template}
