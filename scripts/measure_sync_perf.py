import argparse
import logging
import os
import sys
import time
import uuid
from unittest.mock import MagicMock, patch

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.shared.db.models.knowledge import Document, KnowledgeBase
from apps.workflow_engine.services.sync_service import SyncService

# 로깅 설정
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# Tiktoken 로드
try:
    import tiktoken
except ImportError:
    tiktoken = None


def count_tokens(text: str) -> int:
    if tiktoken:
        try:
            enc = tiktoken.get_encoding("cl100k_base")
            return len(enc.encode(text))
        except Exception:
            return len(text) // 4
    else:
        return len(text) // 4


def generate_mock_data(num_rows=1000, edge_case=False):
    """테스트용 Mock 데이터 생성 (Normal vs Edge Case)"""
    data = []
    print(f"Generating {num_rows} mock rows (Edge Case: {edge_case})...")

    # Edge Case용 샘플 데이터
    special_chars = "!@#$%^&*()_+{}|:<>?`~-=[]\;',./" * 10
    korean_sample = "안녕하세요. 이것은 한국어 테스트입니다. " * 5
    emoji_sample = "🚀🌟🔥😊👍" * 10
    very_long_text = "Long text " * 500  # 약 1000단어

    for i in range(num_rows):
        if edge_case:
            # 엣지 케이스 시나리오 랜덤 적용
            case_type = i % 5
            if case_type == 0:
                # 1. 매우 긴 텍스트 (Token Limit 근접 테스트)
                name = f"Edge-Long-{i}"
                desc = very_long_text
            elif case_type == 1:
                # 2. 특수문자 폭탄
                name = f"Edge-Special-{i}"
                desc = special_chars
            elif case_type == 2:
                # 3. 다국어 혼합
                name = f"Edge-MultiLang-{i}"
                desc = f"{korean_sample} + {emoji_sample} + English"
            elif case_type == 3:
                # 4. 빈 내용 (또는 공백만)
                name = f"Edge-Empty-{i}"
                desc = "   "
            else:
                # 5. 정상 데이터 (섞여있음)
                name = f"Edge-Normal-{i}"
                desc = f"Normal description {i}"
        else:
            # 일반 데이터
            name = f"Mock Product {i}"
            desc = (
                f"This is a description for product {i}. It supports vector search." * 3
            )

        data.append({"id": i, "name": name, "description": desc, "price": 1000 + i})
    return data


def run_benchmark(num_rows=1000, edge_case=False):
    print(
        f"\n🚀 Starting Sync Benchmark (Mock Mode, Rows: {num_rows}, Edge: {edge_case})"
    )
    print("--------------------------------------------------")

    # 1. Mock Data Setup
    mock_chunks = []
    total_tokens = 0
    max_tokens_in_row = 0

    start_gen = time.time()
    mock_data = generate_mock_data(num_rows, edge_case)

    for i, row in enumerate(mock_data):
        text = f"{row['name']} : {row['description']}"
        tokens = count_tokens(text)
        total_tokens += tokens

        if tokens > max_tokens_in_row:
            max_tokens_in_row = tokens

        chunk = {"content": text, "token_count": tokens, "metadata": {"row_id": i}}
        mock_chunks.append(chunk)
    end_gen = time.time()
    print(f"✅ Mock Data Generation Time: {end_gen - start_gen:.4f}s")

    # Processor Result Mock
    mock_process_result = MagicMock()
    mock_process_result.chunks = mock_chunks

    # 2. Mock DB Session & ORM Objects
    mock_db = MagicMock()
    user_id = uuid.uuid4()
    kb_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    mock_kb = MagicMock(spec=KnowledgeBase)
    mock_kb.id = kb_id
    mock_kb.name = "Benchmark KB"
    mock_kb.user_id = user_id
    mock_kb.embedding_model = "text-embedding-3-small"

    mock_doc = MagicMock(spec=Document)
    mock_doc.id = doc_id
    mock_doc.knowledge_base_id = kb_id
    mock_doc.filename = "benchmark_table"
    mock_doc.source_type = "DB"
    mock_doc.meta_info = {
        "db_config": {"table": "mock_table", "connection_id": "mock_conn"}
    }

    def query_side_effect(model_cls):
        query_mock = MagicMock()
        name = getattr(model_cls, "__name__", str(model_cls))
        if "KnowledgeBase" in name:
            query_mock.filter.return_value.all.return_value = [mock_kb]
        elif "Document" in name:
            query_mock.filter.return_value.all.return_value = [mock_doc]
        return query_mock

    mock_db.query.side_effect = query_side_effect

    # 3. Instantiate & Patch Services
    print("🔧 Setting up Service Mocks...")
    with (
        patch(
            "apps.workflow_engine.services.sync_service.DbProcessor"
        ) as PatchedProcessor,
        patch(
            "apps.workflow_engine.services.sync_service.VectorStoreService"
        ) as PatchedVectorStore,
    ):
        mock_processor_instance = PatchedProcessor.return_value
        mock_processor_instance.process.return_value = mock_process_result

        mock_vector_store_instance = PatchedVectorStore.return_value
        mock_vector_store_instance.save_chunks.return_value = None

        service = SyncService(db=mock_db, user_id=user_id)

        graph_data = {
            "nodes": [
                {
                    "id": "llm-1",
                    "type": "llmNode",
                    "data": {"knowledgeBases": [{"id": str(kb_id)}]},
                }
            ]
        }

        # 4. Execute Benchmark
        print("\n⏱️  Running SyncService.sync_knowledge_bases...")
        print("--------------------------------------------------")
        start_time = time.time()

        try:
            synced_count = service.sync_knowledge_bases(graph_data)
        except Exception as e:
            print(f"❌ CRITICAL ERROR during execution: {e}")
            sys.exit(1)

        end_time = time.time()
        total_time = end_time - start_time

        # 5. Report
        print("\n" + "=" * 50)
        print(f"📊 BENCHMARK RESULT (Rows: {num_rows}, Edge: {edge_case})")
        print("=" * 50)
        print(f"✅ Synced Documents : {synced_count}")
        print(f"⏱️  Total Processing Time: {total_time:.4f}s")
        if total_time > 0:
            tps = num_rows / total_time
            print(f"🚀 Throughput        : {tps:.1f} rows/sec")
        print("-" * 50)
        print(f"📝 Total Tokens      : {total_tokens:,}")
        print(f"📈 Max Tokens / Row  : {max_tokens_in_row:,}")

        cost_small = (total_tokens / 1_000_000) * 0.02
        print(f"💰 Global Cost (Est.) : ${cost_small:.6f}")
        print("=" * 50 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=1000)
    parser.add_argument(
        "--edge",
        action="store_true",
        help="Generate edge case data (long text, special chars)",
    )
    args = parser.parse_args()

    if not tiktoken:
        print(
            "⚠️  Warning: 'tiktoken' library not found. Token counts will be inaccurate."
        )

    run_benchmark(args.rows, args.edge)
