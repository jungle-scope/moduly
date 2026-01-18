"""
LLM 클라이언트의 공통 인터페이스.

각 provider별 클라이언트는 이 추상 클래스를 상속해 구현합니다.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class BaseLLMClient(ABC):
    """
    provider별 클라이언트의 기본 구조를 정의합니다.

    Args:
        model_id: 사용할 모델 식별자 (예: gpt-4o)
        credentials: API 호출에 필요한 자격 정보 딕셔너리
    """

    def __init__(self, model_id: str, credentials: Optional[Dict[str, Any]] = None):
        self.model_id = model_id
        self.credentials = credentials or {}

    @abstractmethod
    async def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        LLM에 메시지를 전달하고 결과를 반환합니다 (비동기).

        Args:
            messages: role/content 형식의 메시지 리스트
            **kwargs: 추가 옵션 (온도, 토큰 제한 등)

        Returns:
            모델 응답을 담은 딕셔너리
        """
        raise NotImplementedError

    @abstractmethod
    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        메시지 리스트가 소비할 토큰 수를 추정/계산합니다.

        Args:
            messages: role/content 형식의 메시지 리스트

        Returns:
            예상 토큰 수
        """
        raise NotImplementedError

    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        """
        단일 텍스트에 대한 임베딩 벡터를 반환합니다 (비동기).
        
        Args:
            text: 임베딩할 텍스트
            
        Returns:
            float 리스트 형태의 벡터
        """
        raise NotImplementedError

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        (선택 구현) 다수 텍스트에 대한 임베딩 벡터 리스트를 반환합니다 (비동기).
        기본 구현은 embed를 반복 호출합니다.
        
        Args:
            texts: 임베딩할 텍스트 리스트
            
        Returns:
            벡터 리스트의 리스트
        """
        return [await self.embed(t) for t in texts]

