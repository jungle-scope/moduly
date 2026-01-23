"""
프롬프트 위저드 API 엔드포인트.

사용자의 프롬프트를 AI가 개선해주는 기능을 제공합니다.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.prompt_wizard_service import (
    check_credentials as check_prompt_wizard_credentials,
)
from apps.gateway.services.prompt_wizard_service import (
    improve_prompt as improve_prompt_service,
)
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db

router = APIRouter()


class PromptImproveRequest(BaseModel):
    """프롬프트 개선 요청"""

    prompt_type: Literal["system", "user", "assistant"]
    original_prompt: str
    registered_variables: Optional[List[str]] = None
    model_id: Optional[str] = None


class PromptImproveResponse(BaseModel):
    """프롬프트 개선 응답"""

    improved_prompt: str


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
    return {"has_credentials": check_prompt_wizard_credentials(db, current_user)}


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
    improved_prompt = await improve_prompt_service(
        prompt_type=request.prompt_type,
        original_prompt=request.original_prompt,
        model_id=request.model_id,
        db=db,
        current_user=current_user,
    )
    return {"improved_prompt": improved_prompt}
