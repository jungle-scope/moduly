"""
Google(Gemini)용 LLM 클라이언트.

현재 Google Gemini API는 OpenAI 호환 엔드포인트를 제공하므로,
OpenAIClient를 상속받아 구현합니다.
추후 Google 전용 기능(Safety Setting 등)이 필요해지면 여기서 확장합니다.
"""

from typing import Any, Dict

from .openai_client import OpenAIClient


class GoogleClient(OpenAIClient):
    """
    Google Gemini (OpenAI Compatible) 클라이언트.
    """
    
    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        super().__init__(model_id=model_id, credentials=credentials)
        # Google specific initialization if needed
