"""
코드 위저드 API 엔드포인트.

사용자의 자연어 설명을 기반으로 Code Node에서 실행 가능한 Python 코드를 생성합니다.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.services.code_wizard_service import (
    check_credentials as check_code_wizard_credentials,
)
from apps.gateway.services.code_wizard_service import (
    generate_code as generate_code_service,
)
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db

router = APIRouter()


class CodeGenerateRequest(BaseModel):
    """코드 생성 요청"""

    description: str
    input_variables: List[str] = []
    model_id: Optional[str] = None


class CodeGenerateResponse(BaseModel):
    """코드 생성 응답"""

    generated_code: str


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
    return {"has_credentials": check_code_wizard_credentials(db, current_user)}


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
    generated_code = await generate_code_service(
        description=request.description,
        input_variables=request.input_variables,
        model_id=request.model_id,
        db=db,
        current_user=current_user,
    )
    return {"generated_code": generated_code}
