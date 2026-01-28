"""
Gateway Ingestion Celery Tasks
문서 파싱 및 임베딩을 비동기적으로 처리합니다.
"""

import logging
from uuid import UUID

from celery import Task

from apps.shared.celery_app import celery_app
from apps.shared.db.session import SessionLocal

logger = logging.getLogger(__name__)


class IngestionTask(Task):
    """
    Ingestion 태스크를 위한 베이스 클래스
    실패 시 정리 작업 등을 수행할 수 있습니다.
    """

    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(f"Ingestion Task failed: {exc}", exc_info=exc)
        super().on_failure(exc, task_id, args, kwargs, einfo)


@celery_app.task(
    name="ingestion.parse_document",
    bind=True,
    base=IngestionTask,
    max_retries=3,
    acks_late=True,  # 태스크 완료 후 ACK (안정성)
)
def parse_document(self, document_id: UUID):
    """
    문서 파싱 및 청킹을 비동기적으로 수행합니다.

    Args:
        document_id: 처리할 문서 ID
    """
    from apps.gateway.services.ingestion.service import IngestionOrchestrator

    db = SessionLocal()
    try:
        # [Step 1] 문서 및 유저 정보 조회
        # IngestionOrchestrator가 내부적으로 user_id를 사용할 수 있으므로(예: DB Processor),
        # 미리 조회하여 주입해야 합니다.
        from apps.shared.db.models.knowledge import Document, KnowledgeBase

        doc = (
            db.query(Document)
            .join(KnowledgeBase)
            .filter(Document.id == document_id)
            .first()
        )

        if not doc:
            logger.warning(f"[Ingestion] 문서를 찾을 수 없음: {document_id}")
            return

        user_id = doc.knowledge_base.user_id

        # [Step 2] 서비스 초기화
        # 주의: IngestionOrchestrator.process_document 내부에서 별도의 SessionLocal()을 생성하여
        # self.db를 덮어쓰는 구조가 있습니다. 하지만 초기화 시 user_id 전달은 필수적입니다.
        service = IngestionOrchestrator(db=db, user_id=user_id)

        # [Step 3] 동기 메서드 호출 (내부에서 DistributedLock 및 별도 DB 세션 사용)
        service.process_document(document_id=document_id)

        logger.info(f"[Ingestion] 파싱 태스크 완료: {document_id}")
        return {"status": "success", "document_id": str(document_id)}

    except Exception as e:
        logger.error(f"[Ingestion] 파싱 태스크 실패: {e}")
        # db 세션은 조회용이므로 롤백 불필요 (읽기 전용)
        # 재시도 가능한 에러인 경우 재시도 로직 추가 가능
        raise self.retry(exc=e, countdown=60)  # 1분 후 재시도

    finally:
        db.close()
