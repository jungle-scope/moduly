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
    [Workflow Engine] 실행 전 DB 지식 베이스 동기화 서비스
    """

    def __init__(self, db: Session, user_id: UUID):
        self.db = db
        self.user_id = user_id
        # Shared Processors & Services
        self.db_processor = DbProcessor(db_session=db, user_id=user_id)
        self.vector_store_service = VectorStoreService(db=db, user_id=user_id)

    def sync_knowledge_bases(self, graph_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        워크플로우 그래프에서 DB 타입 지식 베이스를 찾아 동기화(Ingestion)를 수행합니다.
        실행 직전에 최신 데이터를 가져오기 위함입니다.

        Args:
            graph_data: 워크플로우 그래프 데이터 {"nodes": [...]}

        Returns:
            Dict[str, Any]: {
                "synced_count": int,
                "failed": List[Dict]  # [{"filename": str, "last_synced": str, "error": str}]
            }
        """
        kb_ids = self._extract_knowledge_base_ids(graph_data)
        if not kb_ids:
            logger.info("[동기화] 동기화할 지식 베이스 없음")
            return {"synced_count": 0, "failed": []}

        logger.info(f"[동기화] {len(kb_ids)}개 지식 베이스 동기화 시작")
        synced_count = 0
        failed_docs = []

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
                        f"[동기화] 외부 DB 동기화 중: {doc.filename} (지식 베이스: {kb.name})"
                    )

                    # 1. DB Fetch & Process
                    source_config = dict(doc.meta_info or {})

                    # db_config가 있으면 flatten (Gateway _build_config와 동일)
                    if "db_config" in source_config and isinstance(
                        source_config["db_config"], dict
                    ):
                        source_config.update(source_config["db_config"])

                    # Connection ID가 없으면 Skip (설정 미완료 등)
                    if not source_config.get("connection_id"):
                        logger.warning(
                            f"[동기화] 외부 DB {doc.filename}에 connection_id 없음, 건너뜀."
                        )
                        continue

                    logger.info(
                        f"[동기화] source_config selections: {source_config.get('selections', [])}"
                    )

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
                    logger.error(f"[동기화] 외부 DB {doc.filename} 동기화 실패: {e}")

                    last_sync = (
                        doc.updated_at.strftime("%Y-%m-%d %H:%M:%S")
                        if doc.updated_at
                        else "알 수 없음"
                    )
                    failed_docs.append(
                        {
                            "filename": doc.filename,
                            "last_synced": last_sync,
                            "error": str(e),
                        }
                    )
                    # 워크플로우 실행 자체를 막지 않고 이전 데이터로 계속 실행
                    continue

        if synced_count > 0 or failed_docs:
            logger.info(
                f"[동기화] 완료 - 성공: {synced_count}개, 실패: {len(failed_docs)}개"
            )

        # 실패한 문서에 대한 상세 경고
        if failed_docs:
            for doc_info in failed_docs:
                logger.warning(
                    f"[동기화] ⚠️ '{doc_info['filename']}' 동기화 실패 - "
                    f"이전 데이터 사용 (마지막 동기화: {doc_info['last_synced']}). "
                    f"원인: {doc_info['error']}"
                )

        return {"synced_count": synced_count, "failed": failed_docs}

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
