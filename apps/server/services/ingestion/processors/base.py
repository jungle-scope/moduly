from abc import ABC, abstractmethod
from typing import Any, Dict, List

from pydantic import BaseModel


class ProcessingResult(BaseModel):
    """
    모든 프로세서가 반환해야 하는 표준 결과 포맷입니다.
    텍스트 청크 리스트와 메타데이터를 포함합니다.
    """

    chunks: List[Dict[str, Any]]  # [{"content": "...", "metadata": {...}}, ...]
    metadata: Dict[
        str, Any
    ]  # 처리 과정에서 생성된 추가 메타데이터 (예: 토큰 수, 비용 등)


class BaseProcessor(ABC):
    """
    [BaseProcessor]
    모든 자료 처리기(File, API, DB)의 공통 인터페이스입니다.
    Strategy Pattern의 Context 역할을 하는 Factory에 의해 호출됩니다.
    """

    def __init__(self, db_session=None, user_id=None):
        """
        공통적으로 필요한 DB 세션과 사용자 ID를 초기화합니다.

        Args:
            db_session: Database Session (SQLAlchemy)
            user_id: 요청한 사용자의 UUID (권한 확인 및 로깅용)
        """
        self.db = db_session
        self.user_id = user_id

    @abstractmethod
    def process(self, source_config: Dict[str, Any]) -> ProcessingResult:
        """
        [핵심 메서드] 소스 설정을 받아 데이터를 수집, 파싱, 가공하여 청크를 반환합니다.

        Args:
            source_config: 소스별 설정값 (예: {"file_path": "...", "api_url": "..."})

        Returns:
            ProcessingResult: 처리된 청크 리스트 및 메타데이터
        """
        pass

    def analyze(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        (Optional) 소스 데이터를 분석하여 메타데이터나 비용 예측 정보를 반환합니다.
        지원하지 않는 경우 빈 딕셔너리를 반환합니다.
        """
        return {}
