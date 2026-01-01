"""
provider 이름에 따라 LLM 클라이언트를 생성하는 팩토리.

확장 포인트:
- "anthropic", "azure" 등 다른 provider를 추가할 때 분기만 늘리면 됩니다.
"""

from typing import Any, Dict

from .base import BaseLLMClient
from .openai_client import OpenAIClient
from .google_client import GoogleClient


def get_llm_client(
    provider: str, model_id: str, credentials: Dict[str, Any]
) -> BaseLLMClient:
    """
    provider 이름에 따라 적절한 LLM 클라이언트를 반환합니다.

    Args:
        provider: "openai" 등 provider 식별자
        model_id: 호출에 사용할 모델 식별자
        credentials: API 호출에 필요한 자격 정보 (apiKey, baseUrl 등)

    Raises:
        ValueError: 지원하지 않는 provider일 경우
    """
    key = provider.lower()

    if key == "openai":
        return OpenAIClient(model_id=model_id, credentials=credentials)
    
    if key == "google":
        return GoogleClient(model_id=model_id, credentials=credentials)
    
    # Anthropic/Azure 등 추가 예정
    if key == "anthropic":
        # Anthropic is currently treated as OpenAI compatible for MVP or needs explicit client
        # For now, if we assume proxy usage, use OpenAIClient. Ideally create AnthropicClient.
        # But to be clean, let's keep it simple.
        return OpenAIClient(model_id=model_id, credentials=credentials)

    raise ValueError(f"Unsupported provider: {provider}")
