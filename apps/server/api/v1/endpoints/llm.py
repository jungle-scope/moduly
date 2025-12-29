from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from db.session import get_db
from schemas.llm import LLMProviderResponse, LLMProviderSimpleCreate
from services.llm_service import LLMService

router = APIRouter()


@router.get("/providers", response_model=List[LLMProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    """
    provider 전체 목록을 반환합니다. (임시 공유 모드)
    - credential.encrypted_config는 마스킹되어 내려갑니다.
    - TODO: 추후 로그인 사용자별 필터 필요
    """
    try:
        return LLMService.list_providers(db)
    except ValueError as exc:
        # provider별 안내 메시지 제공
        detail = str(exc)
        if request.provider_type.lower() in ("google", "gemini"):
            detail = f"Google Gemini 키 검증 실패: {detail} (콘솔에서 발급한 API Key인지 확인하세요)"
        elif request.provider_type.lower() in ("anthropic", "claude"):
            detail = f"Anthropic 키 검증 실패: {detail} (대시보드에서 발급한 Key인지 확인하세요)"
        else:
            detail = f"OpenAI 키 검증 실패: {detail} (대시보드에서 발급한 Key인지 확인하세요)"
        raise HTTPException(status_code=400, detail=detail)


@router.post("/providers", response_model=LLMProviderResponse)
def create_provider(
    request: LLMProviderSimpleCreate,
    db: Session = Depends(get_db),
):
    """
    LLM provider + credential을 동시에 생성합니다.

    - 입력: alias(=provider_name), apiKey(credential로 저장), user_id(optional)
    - user_id가 없으면 DB 첫 사용자 → placeholder(12345678-...) 사용자 레코드 자동 생성 순으로 fallback
    - TODO: 로그인 사용자로 고정하도록 변경 예정
    """
    try:
        return LLMService.create_provider_with_credential(db, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: str, db: Session = Depends(get_db)):
    """
    provider와 연결된 credential을 함께 삭제합니다. (임시 공유 모드)
    - TODO: 로그인 사용자/권한 검증 추가 필요
    """
    try:
        provider_uuid = UUID(str(provider_id))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid provider id")

    try:
        deleted = LLMService.delete_provider(db, provider_uuid)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not deleted:
        raise HTTPException(status_code=404, detail="Provider not found")

    return {"message": "Provider deleted", "id": str(provider_uuid)}
