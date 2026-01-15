from abc import ABC, abstractmethod
from typing import Any


class BaseTransformer(ABC):
    """
    [BaseTransformer]
    구조화된 데이터나 Raw 텍스트를 LLM 학습/검색에 적합한 형태로 변환(Transformation)합니다.
    예: DB Row(Dict) -> 자연어 문장, HTML -> Plain Text 등
    """

    @abstractmethod
    def transform(self, input_data: Any, **kwargs) -> str:
        """
        입력 데이터를 자연어 텍스트(String)로 변환합니다.

        Args:
            input_data: 변환할 원본 데이터 (Dict, List, String 등)
            kwargs: 변환 옵션

        Returns:
            str: 변환된 텍스트
        """
        pass
