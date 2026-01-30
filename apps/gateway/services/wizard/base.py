import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from apps.shared.db.models.llm import LLMCredential, LLMProvider

logger = logging.getLogger(__name__)


def get_valid_credential(db: Session, user_id: int) -> Optional[LLMCredential]:
    """유효한 LLM Credential을 조회합니다."""
    return (
        db.query(LLMCredential)
        .filter(LLMCredential.user_id == user_id, LLMCredential.is_valid)
        .first()
    )


def select_model(
    db: Session, credential: LLMCredential, model_map: Dict[str, str], feature_name: str
) -> str:
    """Provider에 맞는 효율적인 모델을 선택합니다."""
    provider = (
        db.query(LLMProvider).filter(LLMProvider.id == credential.provider_id).first()
    )

    if not provider:
        raise HTTPException(status_code=400, detail="Provider 정보를 찾을 수 없습니다.")

    provider_name = provider.name.lower()
    model_id = model_map.get(provider_name)

    if not model_id:
        raise HTTPException(
            status_code=400,
            detail=f"현재 '{provider.name}'에서는 {feature_name} 기능을 사용할 수 없습니다. OpenAI, Google, Anthropic Provider를 이용해주세요.",
        )
    return model_id


def parse_llm_response(response: Any) -> str:
    """LLM 응답을 파싱하여 텍스트만 추출합니다."""
    # OpenAI style
    if isinstance(response, dict):
        if "choices" in response and response["choices"]:
            return response["choices"][0].get("message", {}).get("content", "")
        elif "content" in response:
            return response["content"]

    # String
    if isinstance(response, str):
        return response

    logger.error(f"Unknown response format: {response}")
    raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")
