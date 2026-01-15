import logging
from typing import Any, Dict, Set
from uuid import UUID

from sqlalchemy.orm import Session

from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.services.ingestion.processors.db_processor import DbProcessor
from apps.shared.services.ingestion.vector_store_service import VectorStoreService

logger = logging.getLogger(__name__)


class SyncService:
    """
    [Workflow Engine] 실행 전 DB 지식베이스 동기화 서비스
    """

    def __init__(self, db: Session, user_id: UUID):
        self.db = db
        self.user_id = user_id
        # Shared Processors & Services
        self.db_processor = DbProcessor(db_session=db, user_id=user_id)
        self.vector_store_service = VectorStoreService(db=db, user_id=user_id)

    def sync_knowledge_bases(self, graph_data: Dict[str, Any]) -> int:
        """
        워크플로우 그래프에서 DB 타입 지식베이스를 찾아 동기화(Ingestion)를 수행합니다.
        실행 직전에 최신 데이터를 가져오기 위함입니다.

        Args:
            graph_data: 워크플로우 그래프 데이터 {"nodes": [...]}

        Returns:
            int: 동기화에 성공한 문서 수
        """
        kb_ids = self._extract_knowledge_base_ids(graph_data)
        if not kb_ids:
            return 0

        synced_count = 0

        # DB 타입 KnowledgeBase만 필터링 조회
        kbs = (
            self.db.query(KnowledgeBase)
            .filter(
                KnowledgeBase.id.in_(kb_ids),
                KnowledgeBase.user_id == self.user_id,
                # SourceType Check: KB 자체에는 type이 없으므로 Document에서 확인하거나,
                # 여기서 KB를 가져온 후 Document를 조회할 때 필터링
            )
            .all()
        )

        for kb in kbs:
            # KB에 연결된 'SourceType.DB' 문서 조회
            documents = (
                self.db.query(Document)
                .filter(
                    Document.knowledge_base_id == kb.id,
                    Document.source_type == SourceType.DB,
                )
                .all()
            )

            for doc in documents:
                try:
                    logger.info(
                        f"[SyncService] Syncing document {doc.id} (KB: {kb.name})"
                    )

                    # 1. DB Fetch & Process
                    # Document.meta_info에 connection_id, sql 등의 source_config가 있다고 가정
                    source_config = doc.meta_info or {}

                    # Connection ID가 없으면 Skip (설정 미완료 등)
                    if not source_config.get("connection_id"):
                        logger.warning(f"Document {doc.id} has no connection_id")
                        continue

                    # Processor 실행 (DB 접속 -> SQL 실행 -> NL 변환 -> Chunking)
                    result = self.db_processor.process(source_config)

                    # 2. Vector Store Save (Embedding -> DB Save)
                    self.vector_store_service.save_chunks(
                        document_id=doc.id,
                        chunks=result.chunks,
                        model_name=kb.embedding_model or "text-embedding-3-small",
                    )

                    synced_count += 1

                except Exception as e:
                    logger.error(f"[SyncService] Failed to sync document {doc.id}: {e}")
                    # 워크플로우 실행 자체를 막을지 여부:
                    # 현재는 동기화 실패 시 '이전 데이터'로라도 실행되도록 Log만 남김.
                    continue

        if synced_count > 0:
            logger.info(f"[SyncService] Total {synced_count} documents synced.")

        return synced_count

    def _extract_knowledge_base_ids(self, graph_data: Dict[str, Any]) -> Set[UUID]:
        """그래프 내 LLM 노드에서 사용된 KB ID 추출"""
        ids = set()
        nodes = graph_data.get("nodes", [])
        for node in nodes:
            if node.get("type") == "llmNode":
                data = node.get("data", {})
                # data.knowledgeBases = [{"id": "...", "name": "..."}]
                kbs = data.get("knowledgeBases", [])
                for kb in kbs:
                    if isinstance(kb, dict) and "id" in kb:
                        try:
                            ids.add(UUID(kb["id"]))
                        except ValueError:
                            pass
        return ids
