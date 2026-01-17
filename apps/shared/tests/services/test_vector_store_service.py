import uuid
from unittest.mock import MagicMock, patch

import pytest
from apps.shared.db.models.knowledge import Document
from apps.shared.services.ingestion.vector_store_service import VectorStoreService

# ------------------------------------------------------------------
# Mocks & Fixtures
# ------------------------------------------------------------------


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def mock_encryption():
    with patch(
        "apps.shared.services.ingestion.vector_store_service.encryption_manager"
    ) as mock:
        # Pass-through encryption/decryption
        mock.encrypt.side_effect = lambda x: x
        mock.decrypt.side_effect = lambda x: x
        yield mock


@pytest.fixture
def mock_embedding_service():
    with patch(
        "apps.shared.services.ingestion.vector_store_service.EmbeddingService"
    ) as MockCls:
        instance = MockCls.return_value
        # Mock embedding return: simple list of 1536 floats
        instance.embed_batch.side_effect = lambda texts, model: [
            [0.1] * 1536 for _ in texts
        ]
        yield instance


@pytest.fixture
def service(mock_db, mock_encryption, mock_embedding_service):
    user_id = uuid.uuid4()
    return VectorStoreService(db=mock_db, user_id=user_id)


@pytest.fixture
def mock_document(mock_db):
    doc_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    mock_doc = MagicMock(spec=Document)
    mock_doc.id = doc_id
    mock_doc.knowledge_base_id = kb_id
    mock_doc.embedding_model = "text-embedding-3-small"

    # DB query for Document returns this doc
    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc
    return mock_doc


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------


def test_incremental_update_scenarios(
    service, mock_db, mock_document, mock_embedding_service
):
    """
    증분 업데이트(Incremental Update) 로직 검증
    Scenario 1: 최초 저장 (DB 비어있음 -> 전체 임베딩)
    Scenario 2: 재실행 (데이터 변경 없음 -> 100% 재사용, API 호출 0)
    Scenario 3: 부분 변경 (5개 중 1개만 변경 -> 1개만 임베딩)
    """
    doc_id = mock_document.id

    # ------------------------------------------------------------
    # Scenario 1: First Run (Empty DB)
    # ------------------------------------------------------------
    # Mock: Existing chunks = []
    mock_db.query.return_value.filter.return_value.all.return_value = []

    chunks_input = [
        {"content": f"content {i}", "metadata": {"id": i}} for i in range(5)
    ]

    service.save_chunks(doc_id, chunks_input)

    # Assertions
    # 1. Embed API called for all 5 chunks
    assert mock_embedding_service.embed_batch.call_count >= 1
    # 2. Existing chunks deleted
    mock_db.query.return_value.filter.return_value.delete.assert_called()
    # 3. New chunks bulk saved
    saved_chunks = mock_db.bulk_save_objects.call_args[0][0]
    assert len(saved_chunks) == 5

    print("\n✅ Scenario 1 (First Run) Passed")

    # ------------------------------------------------------------
    # Scenario 2: Re-run (Same Data) -> EXPECT 0 API CALLS
    # ------------------------------------------------------------
    # Mock: DB now has the chunks we just saved
    mock_db.query.return_value.filter.return_value.all.return_value = saved_chunks

    # Reset mock counters
    mock_embedding_service.embed_batch.reset_mock()
    mock_db.bulk_save_objects.reset_mock()

    # Run again with same input
    service.save_chunks(doc_id, chunks_input)

    # Assertions
    # 1. Embed API should NOT be called
    mock_embedding_service.embed_batch.assert_not_called()
    # 2. Bulk save still happens (Atomic Swap)
    mock_db.bulk_save_objects.assert_called()
    reused_saved_chunks = mock_db.bulk_save_objects.call_args[0][0]
    assert len(reused_saved_chunks) == 5
    # 3. Check embeddings are reused (same object reference or value)
    assert reused_saved_chunks[0].embedding == saved_chunks[0].embedding

    print("✅ Scenario 2 (Full Reuse) Passed")

    # ------------------------------------------------------------
    # Scenario 3: Partial Change (1 Chunk Updated)
    # ------------------------------------------------------------
    # Update input: Modify 5th chunk
    input_changed = [c.copy() for c in chunks_input]
    input_changed[4]["content"] = "content 4 UPDATED"

    # Mock: DB still has the original chunks (from Scenario 1)
    mock_db.query.return_value.filter.return_value.all.return_value = saved_chunks

    # Reset counters
    mock_embedding_service.embed_batch.reset_mock()

    # Run with changed input
    service.save_chunks(doc_id, input_changed)

    # Assertions
    # 1. Embed API called exactly ONCE (or enough for batch)
    assert mock_embedding_service.embed_batch.call_count == 1

    # Verify ONLY the changed chunk was passed to embed function
    call_args = mock_embedding_service.embed_batch.call_args
    texts_to_embed = call_args[0][0]  # first arg is texts list

    assert len(texts_to_embed) == 1
    assert texts_to_embed[0] == "content 4 UPDATED"

    print("✅ Scenario 3 (Partial Update) Passed")
