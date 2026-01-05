from abc import ABC, abstractmethod
from typing import Any, Dict, List


class BaseParser(ABC):
    """
    [BaseParser]
    Raw 데이터(파일, 바이너리, 텍스트 스트림 등)를
    시스템이 이해할 수 있는 텍스트 블록 리스트로 변환하는 인터페이스입니다.
    """

    @abstractmethod
    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        """
        파일이나 리소스를 파싱하여 텍스트 블록 리스트를 반환합니다.

        Args:
            source_path: 파일 경로 또는 리소스 식별자
            kwargs: 파서별 추가 옵션 (예: encoding, strategy 등)

        Returns:
            List[Dict[str, Any]]:
            [
                {"text": "추출된 텍스트...", "page": 1, ...},
                {"text": "다음 페이지 텍스트...", "page": 2, ...}
            ]
        """
        pass
