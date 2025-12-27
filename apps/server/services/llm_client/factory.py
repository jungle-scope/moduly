from typing import Any, Dict

from .base import BaseLLMClient
from .OpenAIClient import OpenAIClient


def get_llm_client(
    provider: str, model_id: str, credentials: Dict[str, Any]
) -> BaseLLMClient:
    """
    provider 이름에 따라 적절한 LLM 클라이언트를 생성합니다.

    Args:
        provider: 예) "openai", "anthropic" 등
        model_id: 사용할 모델 ID
        credentials: provider별 필요한 인증/설정 정보

    Returns:
        BaseLLMClient 구현체 인스턴스
    """

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        self.model_id = model_id
        self.credentials = credentials

    normalized = provider.lower()

    if normalized == "openai":
        return OpenAIClient(model_id=model_id, credentials=credentials)

    # TODO: 다른 provider 추가 시 여기서 분기
    # if normalized == "anthropic":
    #     return AnthropicClient(...)

    raise ValueError(f"Unsupported provider: {provider}")
