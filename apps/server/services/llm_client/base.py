from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseLLMClient(ABC):
    """
    공통 LLM 클라이언트 인터페이스.

    provider별 구현체는 이 클래스를 상속하고 invoke/get_num_tokens를 구현
    """

    def __init__(self, model_id: str, credentials: Optional[Dict[str, Any]] = None):
        self.model_id = model_id
        self.credentials = credentials or {}

    @abstractmethod
    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        LLM 호출 수행. messages 형식과 반환 포맷은 구현체에서 정의합니다.
        """
        raise NotImplementedError  # override 안하면 런타임에서 터짐

    @abstractmethod
    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        토큰 수 계산. provider SDK를 사용하거나 내부 토크나이저로 구현하세요.
        """
        raise NotImplementedError  # override 안하면 런타임에서 터짐
