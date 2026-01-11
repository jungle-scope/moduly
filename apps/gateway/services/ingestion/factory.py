from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from shared.db.models.knowledge import SourceType
from services.ingestion.processors.base import BaseProcessor


class IngestionFactory:
    """
    [IngestionFactory]
    SourceType에 따라 적절한 Processor 인스턴스를 생성하여 반환합니다.
    Factory Pattern을 적용하여 클라이언트 코드가 구체적인 Processor 클래스를 알 필요가 없게 합니다.
    """

    @staticmethod
    def get_processor(
        source_type: SourceType, db_session: Session, user_id: Optional[UUID] = None
    ) -> BaseProcessor:
        """
        요청된 소스 타입에 맞는 프로세서를 생성합니다.

        Args:
            source_type: 데이터 소스 유형 (FILE, API, DB)
            db_session: DB 세션 (프로세서 내부에서 DB 접근 시 필요)
            user_id: 요청 사용자 ID

        Returns:
            BaseProcessor: 소스별 프로세서 인스턴스 (FileProcessor, ApiProcessor, DbProcessor)
        """
        if source_type == SourceType.FILE:
            from services.ingestion.processors.file_processor import FileProcessor

            return FileProcessor(db_session, user_id)

        elif source_type == SourceType.API:
            from services.ingestion.processors.api_processor import ApiProcessor

            return ApiProcessor(db_session, user_id)

        elif source_type == SourceType.DB:
            from services.ingestion.processors.db_processor import DbProcessor

            return DbProcessor(db_session, user_id)

        # 알 수 없는 타입이나 Enum 값과 일치하는 문자열 입력에 대한 대비책(Fallback)
        # (타입 힌트는 SourceType으로 되어 있지만, 실제 실행 시(runtime) 문자열이 전달될 가능성 고려)
        # 일부 상황에서 Enum 비교 시 문자열도 동일하게 처리되지만, Enum 멤버를 직접 사용하는 것이 더 안전함.

        raise ValueError(f"지원하지 않는 소스 타입입니다: {source_type}")
