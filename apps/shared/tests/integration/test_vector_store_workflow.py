import uuid
from unittest.mock import patch

import pytest
from apps.shared.db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from apps.shared.services.ingestion.processors.base import ProcessingResult
from apps.shared.services.ingestion.vector_store_service import VectorStoreService
from apps.workflow_engine.services.sync_service import SyncService

# ------------------------------------------------------------------
# Advanced Fake DB Session
# ------------------------------------------------------------------


class FakeSession:
    """
    SQLAlchemy Session을 정교하게 모사한 In-Memory DB.
    Service Layer의 로직(쿼리 체이닝, 필터링, 삭제, 저장)을 실제 DB처럼 받아줍니다.
    """

    def __init__(self):
        self.store = {KnowledgeBase: [], Document: [], DocumentChunk: []}
        self.current_model = None
        self.filter_lambda = None
        self.deleted_items = []

    def query(self, model):
        self.current_model = model
        self.filter_lambda = None
        return self

    def filter(self, *args, **kwargs):
        # 간단한 필터링 시뮬레이션
        # 실제 SQLAlchemy Expression을 파싱하기 어려우므로,
        # 여기서는 특정 시나리오(ID 매칭)에 맞춰 동작하도록 구성하거나
        # 테스트 코드에서 주입된 데이터가 적으므로 그냥 통과시킴
        return self

    def all(self):
        items = self.store.get(self.current_model, [])
        # 만약 필터 로직을 구현한다면 여기서 filter_lambda 적용
        return list(items)

    def first(self):
        items = self.all()
        return items[0] if items else None

    def delete(self):
        if self.current_model == DocumentChunk:
            # DocumentChunk 전체 삭제 시뮬레이션 (특정 문서 ID에 대한 필터가 걸려있다고 가정)
            # 여기서는 테스트 데이터가 1개 문서뿐이므로 전체 삭제로 처리해도 무방
            count = len(self.store[DocumentChunk])
            self.store[DocumentChunk] = []
            self.deleted_items.append(f"Deleted {count} chunks")
        return

    def bulk_save_objects(self, objects):
        if not objects:
            return
        model = type(objects[0])
        if model not in self.store:
            self.store[model] = []
        self.store[model].extend(objects)

    def add(self, obj):
        model = type(obj)
        if model not in self.store:
            self.store[model] = []
        self.store[model].append(obj)

    def commit(self):
        pass

    def close(self):
        pass


# ------------------------------------------------------------------
# Integration Test
# ------------------------------------------------------------------


@pytest.fixture
def fake_db():
    return FakeSession()


@pytest.fixture
def mock_encryption():
    with patch(
        "apps.shared.services.ingestion.vector_store_service.encryption_manager"
    ) as mock:
        mock.encrypt.side_effect = lambda x: x
        mock.decrypt.side_effect = lambda x: x
        yield mock


@pytest.fixture
def mock_embedding_service():
    with patch(
        "apps.shared.services.ingestion.vector_store_service.EmbeddingService"
    ) as MockCls:
        instance = MockCls.return_value
        # 임베딩 비용 발생 여부를 확인하기 위해 side_effect 사용
        instance.embed_batch.side_effect = lambda texts, model: [
            [0.1] * 1536 for _ in texts
        ]
        yield instance


@pytest.fixture
def mock_db_processor():
    with patch("apps.workflow_engine.services.sync_service.DbProcessor") as MockCls:
        processor = MockCls.return_value
        yield processor


def test_full_sync_workflow_integration(
    fake_db, mock_encryption, mock_embedding_service, mock_db_processor
):
    """
    [Integration] SyncService -> VectorStoreService -> DB(Fake) 전체 파이프라인 검증
    """
    user_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    # 1. Setup Data in FakeDB
    kb = KnowledgeBase(id=kb_id, name="TestKB", embedding_model="model-v3")
    fake_db.add(kb)

    doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        source_type="DB",
        meta_info={"connection_id": "conn1"},
    )
    fake_db.add(doc)

    # 2. Init Services
    # Real VectorStoreService + Real SyncService
    vector_store_service = VectorStoreService(db=fake_db, user_id=user_id)
    # Inject Mock EmbeddingService (created by fixture patch)

    sync_service = SyncService(db=fake_db, user_id=user_id)
    sync_service.vector_store_service = vector_store_service  # Use REAL service
    sync_service.db_processor = (
        mock_db_processor  # Use MOCK processor (external interaction)
    )

    # ------------------------------------------------------------
    # Phase 1: Initial Sync
    # ------------------------------------------------------------
    # Mock Processor Content
    chunks_v1 = [
        {"content": "A", "token_count": 1, "metadata": {"id": 1}},
        {"content": "B", "token_count": 1, "metadata": {"id": 2}},
    ]
    mock_db_processor.process.return_value = ProcessingResult(
        chunks=chunks_v1, metadata={}
    )

    graph_data = {
        "nodes": [{"type": "llmNode", "data": {"knowledgeBases": [{"id": str(kb_id)}]}}]
    }

    print("\n[Step 1] Initial Sync Start")
    result = sync_service.sync_knowledge_bases(graph_data)

    assert result["synced_count"] == 1
    assert result["failed"] == []
    assert len(fake_db.store[DocumentChunk]) == 2
    assert mock_embedding_service.embed_batch.called
    print("✅ Initial Sync Passed")

    # ------------------------------------------------------------
    # Phase 2: Re-run Sync (No Change)
    # ------------------------------------------------------------
    mock_embedding_service.embed_batch.reset_mock()

    print("[Step 2] Re-run Sync Start")
    result = sync_service.sync_knowledge_bases(graph_data)

    assert result["synced_count"] == 1
    # DB count should still be 2 (old deleted, new inserted)
    assert len(fake_db.store[DocumentChunk]) == 2
    # CRITICAL: API Calls must be 0
    mock_embedding_service.embed_batch.assert_not_called()

    # Check if embedding is preserved (FakeSession objects persist)
    chunks_in_db = fake_db.store[DocumentChunk]
    assert chunks_in_db[0].content == "A"

    print("✅ Re-run Sync Passed (0 API Calls confirmed)")

    # ------------------------------------------------------------
    # Phase 3: Partial Update
    # ------------------------------------------------------------
    mock_embedding_service.embed_batch.reset_mock()

    # Change content: A -> A(Modified), B -> B(Same)
    chunks_v2 = [
        {"content": "A-Modified", "token_count": 1, "metadata": {"id": 1}},
        {"content": "B", "token_count": 1, "metadata": {"id": 2}},
    ]
    mock_db_processor.process.return_value = ProcessingResult(
        chunks=chunks_v2, metadata={}
    )

    print("[Step 3] Partial Update Sync Start")
    result = sync_service.sync_knowledge_bases(graph_data)

    assert result["synced_count"] == 1
    assert len(fake_db.store[DocumentChunk]) == 2

    # Needs 1 call for "A-Modified"
    assert mock_embedding_service.embed_batch.call_count == 1
    texts_embedded = mock_embedding_service.embed_batch.call_args[0][0]
    assert texts_embedded == ["A-Modified"]

    print("✅ Partial Update Passed")
