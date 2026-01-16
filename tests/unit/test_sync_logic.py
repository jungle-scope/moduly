import uuid
from unittest.mock import MagicMock, patch

import pytest

from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.services.ingestion.processors.base import ProcessingResult
from apps.workflow_engine.services.sync_service import SyncService


@pytest.fixture
def mock_db_session():
    return MagicMock()


@pytest.fixture
def mock_user_id():
    return uuid.uuid4()


@pytest.fixture
def sync_service(mock_db_session, mock_user_id):
    # Mocking internal services to avoid actual instantiation
    with (
        patch(
            "apps.workflow_engine.services.sync_service.DbProcessor"
        ) as MockDbProcessor,
        patch(
            "apps.workflow_engine.services.sync_service.VectorStoreService"
        ) as MockVectorStoreService,
    ):
        service = SyncService(db=mock_db_session, user_id=mock_user_id)
        service.db_processor = MockDbProcessor.return_value
        service.vector_store_service = MockVectorStoreService.return_value
        return service


def test_extract_knowledge_base_ids(sync_service):
    """그래프 데이터에서 KnowledgeBase ID가 올바르게 추출되는지 테스트"""
    kb_id_1 = str(uuid.uuid4())
    kb_id_2 = str(uuid.uuid4())

    graph_data = {
        "nodes": [
            {
                "type": "llmNode",
                "data": {
                    "knowledgeBases": [
                        {"id": kb_id_1, "name": "KB1"},
                        {"id": kb_id_2, "name": "KB2"},
                    ]
                },
            },
            {
                "type": "textNode",  # Should be ignored
                "data": {},
            },
        ]
    }

    extracted_ids = sync_service._extract_knowledge_base_ids(graph_data)
    assert uuid.UUID(kb_id_1) in extracted_ids
    assert uuid.UUID(kb_id_2) in extracted_ids
    assert len(extracted_ids) == 2


def test_sync_knowledge_bases_no_kbs(sync_service):
    """KB가 없는 그래프 데이터의 경우 0을 반환해야 함"""
    graph_data = {"nodes": []}
    count = sync_service.sync_knowledge_bases(graph_data)
    assert count == 0


def test_sync_knowledge_bases_success(sync_service, mock_db_session):
    """DB 타입 문서가 있는 KB에 대해 동기화 로직이 호출되는지 테스트"""
    # Setup Data
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    graph_data = {
        "nodes": [
            {
                "type": "llmNode",
                "data": {"knowledgeBases": [{"id": str(kb_id), "name": "TestDB"}]},
            }
        ]
    }

    # Mock DB Query Results
    mock_kb = KnowledgeBase(id=kb_id, name="TestDB", embedding_model="test-model")
    mock_doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        source_type=SourceType.DB,
        meta_info={"connection_id": "conn1", "sql": "SELECT 1"},
    )

    # mock_db_session.query().filter().all() chaining
    # 1st query: KnowledgeBase
    # 2nd query: Document

    # Query Mocking이 복잡하므로 side_effect를 사용해 순차적으로 결과 반환
    # 하지만 SQLAlchemy query chaining은 MagicMock으로 단순 처리하기 까다로움.
    # filter().in_() 호출 등을 고려해야 함.

    # Strategy: query(Model) 호출 시점에 따라 다른 Mock Query 객체 반환
    query_mock = MagicMock()
    mock_db_session.query.side_effect = lambda model: query_mock

    # filter(...).all() -> Return list
    # 여기서는 단순화를 위해 filter() 호출 후 항상 원하는 리스트를 반환하도록 설정 (정교함보다는 흐름 검증)

    # 하지만 SyncService 코드를 보면:
    # 1. kbs = db.query(KnowledgeBase).filter(...).all()
    # 2. documents = db.query(Document).filter(...).all()

    # 이를 구분하기 위해 query 인자를 확인하거나,
    # mock_db_session.query의 return_value를 매번 설정하는 것이 어려움.
    # side_effect 함수로 분기 처리

    def query_side_effect(model):
        m = MagicMock()
        if model == KnowledgeBase:
            m.filter.return_value.all.return_value = [mock_kb]
        elif model == Document:
            m.filter.return_value.all.return_value = [mock_doc]
        return m

    mock_db_session.query.side_effect = query_side_effect

    # Mock Processor Result
    sync_service.db_processor.process.return_value = ProcessingResult(
        chunks=[{"content": "abc"}], metadata={}
    )

    # Executing
    synced_count = sync_service.sync_knowledge_bases(graph_data)

    # Assertions
    assert synced_count == 1

    # 1. DBProcessor가 호출되었는지 확인
    sync_service.db_processor.process.assert_called_once_with(mock_doc.meta_info)

    # 2. VectorStoreService가 호출되었는지 확인
    sync_service.vector_store_service.save_chunks.assert_called_once()
    args, kwargs = sync_service.vector_store_service.save_chunks.call_args
    assert kwargs["document_id"] == doc_id
    assert kwargs["model_name"] == "test-model"
    assert kwargs["chunks"] == [{"content": "abc"}]


def test_sync_knowledge_bases_skip_if_no_connection_id(sync_service, mock_db_session):
    """connection_id가 없는 문서는 Skip해야 함"""
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()
    graph_data = {
        "nodes": [{"type": "llmNode", "data": {"knowledgeBases": [{"id": str(kb_id)}]}}]
    }

    mock_kb = KnowledgeBase(id=kb_id)
    mock_doc = Document(
        id=doc_id,
        knowledge_base_id=kb_id,
        source_type=SourceType.DB,
        meta_info={},  # No connection_id
    )

    def query_side_effect(model):
        m = MagicMock()
        if model == KnowledgeBase:
            m.filter.return_value.all.return_value = [mock_kb]
        elif model == Document:
            m.filter.return_value.all.return_value = [mock_doc]
        return m

    mock_db_session.query.side_effect = query_side_effect

    count = sync_service.sync_knowledge_bases(graph_data)

    assert count == 0
    sync_service.db_processor.process.assert_not_called()
