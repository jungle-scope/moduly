import argparse
import logging
import os
import sys
import time
import uuid
from typing import List
from unittest.mock import MagicMock, patch

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.shared.db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from apps.shared.services.ingestion.vector_store_service import VectorStoreService
from apps.workflow_engine.services.sync_service import SyncService

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Tiktoken 로드
try:
    import tiktoken
except ImportError:
    tiktoken = None

# ------------------------------------------------------------------
# Mock Infrastructure (In-Memory DB & Services)
# ------------------------------------------------------------------


class FakeSession:
    """SQLAlchemy Session을 흉내내는 In-Memory DB"""

    def __init__(self):
        self.chunks_store: List[DocumentChunk] = []  # document_id -> chunks
        self.kb_store = []
        self.doc_store = []

    def query(self, model):
        self.current_query_model = model
        return self

    def filter(self, *args, **kwargs):
        # 매우 단순화된 필터 로직 (실제 조건식 파싱은 복잡하므로 특정 시나리오만 커버)
        # 실제 코드에서 filter(Document.id == doc_id) 형태로 호출됨
        # 여기서는 단순히 context만 유지하고 all/first/delete 호출 시 처리
        return self

    def all(self):
        if self.current_query_model == DocumentChunk:
            # 항상 현재 저장된 모든 청크 반환 (filter 무시 - 테스트 환경이므로 하나만 다룸)
            return list(self.chunks_store)
        elif self.current_query_model == KnowledgeBase:
            return list(self.kb_store)
        elif self.current_query_model == Document:
            return list(self.doc_store)
        return []

    def first(self):
        if self.current_query_model == Document:
            if self.doc_store:
                return self.doc_store[0]
        return None

    def delete(self):
        if self.current_query_model == DocumentChunk:
            count = len(self.chunks_store)
            self.chunks_store = []  # 전체 삭제 시뮬레이션
            # print(f"DEBUG: Deleted {count} chunks from Memory")
        return

    def bulk_save_objects(self, objects):
        # 객체 저장 시뮬레이션
        for obj in objects:
            self.chunks_store.append(obj)
        # print(f"DEBUG: Saved {len(objects)} chunks to Memory")

    def commit(self):
        pass

    def close(self):
        pass


# ------------------------------------------------------------------
# Mock Data Generators
# ------------------------------------------------------------------


def count_tokens(text: str) -> int:
    if tiktoken:
        try:
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(text))
        except Exception:
            return len(text) // 4
    return len(text) // 4


def generate_mock_data(num_rows=1000, edge_case=False):
    data = []
    print(f"Generating {num_rows} mock rows (Edge Case: {edge_case})...")

    msg = "This is a description for product. It supports vector search." * 3

    for i in range(num_rows):
        if edge_case and i % 10 == 0:
            desc = msg * 20  # Long text
        else:
            desc = f"{msg} {i}"

        data.append(
            {"id": i, "name": f"Item {i}", "description": desc, "price": 1000 + i}
        )
    return data


# ------------------------------------------------------------------
# Execution Logic
# ------------------------------------------------------------------


def run_phase2_benchmark(num_rows=1000, edge_case=False):
    print(f"\n🚀 Starting Phase 2 Incremental Sync Benchmark (Rows: {num_rows})")
    print("=" * 60)

    # 1. Setup Mock Environment
    fake_db = FakeSession()

    # Setup Master Data (KB, Document)
    user_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    mock_kb = MagicMock(spec=KnowledgeBase)
    mock_kb.id = kb_id
    mock_kb.embedding_model = "text-embedding-3-small"
    fake_db.kb_store.append(mock_kb)

    mock_doc = MagicMock(spec=Document)
    mock_doc.id = doc_id
    mock_doc.knowledge_base_id = kb_id
    mock_doc.source_type = "DB"
    mock_doc.meta_info = {
        "db_config": {"table": "mock_table", "connection_id": "mock_conn"}
    }
    fake_db.doc_store.append(mock_doc)

    # 2. Mock VectorStoreService Dependencies
    # EncryptionManager: Pass-through (No encryption for test)
    mock_encryption = MagicMock()
    mock_encryption.decrypt.side_effect = lambda x: x  # return as is
    mock_encryption.encrypt.side_effect = lambda x: x

    # EmbeddingService: Mock token usage
    mock_embedding_service = MagicMock()

    def fake_embed_batch(texts, model):
        # Return fake 1536-dim vectors
        return [[0.1] * 1536 for _ in texts]

    mock_embedding_service.embed_batch.side_effect = fake_embed_batch

    # 3. Initialize Services with Real Classes + Mocks
    # Patch encryption manager globally for the module
    with (
        patch(
            "apps.shared.services.ingestion.vector_store_service.encryption_manager",
            mock_encryption,
        ),
        patch(
            "apps.workflow_engine.services.sync_service.DbProcessor"
        ) as PatchedProcessor,
    ):
        # Setup DbProcessor to return our mock chunks
        mock_data = generate_mock_data(num_rows, edge_case)
        mock_chunks = []
        for i, row in enumerate(mock_data):
            text = f"{row['name']} : {row['description']}"
            mock_chunks.append(
                {
                    "content": text,
                    "token_count": count_tokens(text),
                    "metadata": {"row_id": i},
                }
            )

        mock_process_result = MagicMock()
        mock_process_result.chunks = mock_chunks
        PatchedProcessor.return_value.process.return_value = mock_process_result

        # Init Services
        # IMPORTANT: We use REAL VectorStoreService, but with FakeDB
        real_vector_store = VectorStoreService(db=fake_db, user_id=user_id)
        real_vector_store.embedding_service = mock_embedding_service  # Swap with mock

        sync_service = SyncService(db=fake_db, user_id=user_id)
        sync_service.vector_store_service = real_vector_store  # Inject real service
        sync_service.db_processor = PatchedProcessor.return_value

        graph_data = {
            "nodes": [
                {
                    "id": "llm-1",
                    "type": "llmNode",
                    "data": {"knowledgeBases": [{"id": str(kb_id)}]},
                }
            ]
        }

        # ------------------------------------------------------------
        # Scenario 1: First Run (Empty DB)
        # ------------------------------------------------------------
        print("\n\n🎬 [Scenario 1] Initial Sync (DB Empty)")
        print("-" * 40)

        start_time = time.time()
        c1 = sync_service.sync_knowledge_bases(graph_data)
        end_time = time.time()

        # Stats
        embedded_count_1 = (
            mock_embedding_service.embed_batch.call_count * 50
        )  # approx (batch size 50)
        if embedded_count_1 > num_rows:
            embedded_count_1 = num_rows  # fix overshoot

        print(f"✅ Synced: {c1}")
        print(f"⏱️  Time: {end_time - start_time:.4f}s")
        # In FakeDB, we can see chunks_store
        print(f"📦 Stored Chunks in DB: {len(fake_db.chunks_store)}")
        print("💡 Expected: All rows should be embedded.")

        # ------------------------------------------------------------
        # Scenario 2: Second Run (No Changes)
        # ------------------------------------------------------------
        print("\n\n🎬 [Scenario 2] Re-run Sync (No Data Changes)")
        print("-" * 40)

        # Reset counters
        mock_embedding_service.embed_batch.reset_mock()

        start_time = time.time()
        c2 = sync_service.sync_knowledge_bases(graph_data)
        end_time = time.time()

        embedded_count_2 = mock_embedding_service.embed_batch.call_count

        print(f"✅ Synced: {c2}")
        print(f"⏱️  Time: {end_time - start_time:.4f}s")
        print(f"📦 Stored Chunks in DB: {len(fake_db.chunks_store)}")
        print(f"🔥 API Calls (Embed Batch): {embedded_count_2}")

        if embedded_count_2 == 0:
            print("🎉 SUCCESS: 0 Embedding Calls! Full Reuse Achieved. (Cost: $0)")
        else:
            print(f"⚠️  FAIL: Still called embedding API {embedded_count_2} times.")

        # ------------------------------------------------------------
        # Scenario 3: Partial Change
        # ------------------------------------------------------------
        print("\n\n🎬 [Scenario 3] Partial Update (5 rows changed)")
        print("-" * 40)

        # Modify mock data in DbProcessor
        # Change content of first 5 rows
        for k in range(5):
            mock_process_result.chunks[k]["content"] += " (UPDATED)"

        mock_embedding_service.embed_batch.reset_mock()

        start_time = time.time()
        c3 = sync_service.sync_knowledge_bases(graph_data)
        end_time = time.time()

        # Note: embed_batch is called with batches.
        # modified 5 rows -> likely 1 batch call with 5 texts.
        api_calls = mock_embedding_service.embed_batch.call_count

        print(f"✅ Synced: {c3}")
        print(f"⏱️  Time: {end_time - start_time:.4f}s")
        print(f"🔥 API Calls (Embed Batch): {api_calls}")

        if api_calls > 0:
            print("🎉 SUCCESS: Detected changes and called API.")
        else:
            print("⚠️  FAIL: No API calls detected even though data changed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=1000)
    args = parser.parse_args()

    run_phase2_benchmark(args.rows, False)
