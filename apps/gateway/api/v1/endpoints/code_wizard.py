"""
코드 위저드 API 엔드포인트.

사용자의 자연어 설명을 기반으로 Code Node에서 실행 가능한 Python 코드를 생성합니다.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.wizard import WizardService
from apps.shared.db.models.llm import LLMCredential
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


# === Request/Response Schemas ===
class CodeGenerateRequest(BaseModel):
    """코드 생성 요청"""

    description: str  # 사용자의 자연어 설명 (예: "두 숫자를 더해서 반환하는 코드")
    input_variables: List[str] = []  # 사용 가능한 입력 변수명 (예: ["num1", "num2"])


class CodeGenerateResponse(BaseModel):
    """코드 생성 응답"""

    generated_code: str


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


@router.post("/generate", response_model=CodeGenerateResponse)
async def generate_code(
    request: CodeGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 Python 코드를 생성합니다.

    사용자의 등록된 LLM credential을 사용하여 코드 생성을 수행합니다.
    credential이 없으면 400 에러를 반환합니다.
    """
    generated_code = await WizardService.generate_code(
        db, current_user.id, request.description, request.input_variables
    )
    return {"generated_code": generated_code}
