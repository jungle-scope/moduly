"""
프롬프트 위저드 API 엔드포인트.

사용자의 프롬프트를 AI가 개선해주는 기능을 제공합니다.
"""

from typing import Literal

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


class PromptImproveRequest(BaseModel):
    """프롬프트 개선 요청"""

    prompt_type: Literal["system", "user", "assistant"]
    original_prompt: str


class PromptImproveResponse(BaseModel):
    """프롬프트 개선 응답"""

    improved_prompt: str


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


@router.post("/improve", response_model=PromptImproveResponse)
async def improve_prompt(
    request: PromptImproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 프롬프트를 개선합니다.

    사용자의 등록된 LLM credential을 사용하여 프롬프트 개선을 수행합니다.
    credential이 없으면 400 에러를 반환합니다.
    """
    improved_prompt = await WizardService.improve_prompt(
        db, current_user.id, request.prompt_type, request.original_prompt
    )
    return {"improved_prompt": improved_prompt}
