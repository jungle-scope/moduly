import logging
import os
import sys

# 경로 설정
sys.path.append(os.path.abspath(os.curdir))

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mocking modules BEFORE imports that use them if possible, but here we can monkeypatch after import
from unittest.mock import MagicMock, patch

from dotenv import load_dotenv

load_dotenv()

from apps.gateway.utils.encryption import encryption_manager
from apps.shared.db.models.connection import Connection
from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.db.models.user import User
from apps.shared.db.session import SessionLocal
from apps.workflow_engine.services.sync_service import SyncService


def run_e2e_test():
    """
    End-to-End Sync Test
    1. DB 세션 생성
    2. 테스트용 User, Connection, KB, Document 생성 (없으면)
    3. Workflow Graph 데이터 구성
    4. SyncService 실행 및 검증
    """

    session = SessionLocal()

    try:
        # Pre-check: LLM Credential for OpenAI
        # 실제 환경 테스트이므로 실제 키가 필요하거나, Mocking이 필요함.
        # 여기서는 Mocking보다는 실제 로직 흐름을 타되, Embedding 호출 실패 시 로그 확인하는 방향으로 진행.

        # 1. Get or Create Test User
        user = session.query(User).filter(User.email == "test@moduly.ai").first()
        if not user:
            user = User(
                email="test@moduly.ai",
                password="hashed",
                name="Test User",
                social_provider="email",
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        logger.info(f"Using User: {user.email} ({user.id})")

        # 2. Get or Create Test Connection (Postgres) to Localhost
        conn_name = "test-local-db"
        connection = (
            session.query(Connection)
            .filter(Connection.name == conn_name, Connection.user_id == user.id)
            .first()
        )

        # .env에서 DB 접속 정보 가져오기
        db_user = os.getenv("DB_USER", "moduly")
        db_password = os.getenv("DB_PASSWORD", "moduly")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = int(os.getenv("DB_PORT", 5432))
        db_name = os.getenv("DB_NAME", "moduly_local")

        if not connection:
            # Encrypt password
            enc_pw = encryption_manager.encrypt(db_password)
            connection = Connection(
                user_id=user.id,
                name=conn_name,
                type="postgres",
                host=db_host,
                port=db_port,
                database=db_name,
                username=db_user,
                encrypted_password=enc_pw,
                use_ssh=False,
            )
            session.add(connection)
            session.commit()
            session.refresh(connection)

        logger.info(f"Using Connection: {connection.name} ({connection.id})")

        # 3. Get or Create KnowledgeBase & Document
        kb_name = "E2E Test KB"
        kb = (
            session.query(KnowledgeBase)
            .filter(KnowledgeBase.name == kb_name, KnowledgeBase.user_id == user.id)
            .first()
        )

        # [Corrected Logic] If KB exists, delete it to ensure fresh start
        if kb:
            logger.info(f"Removing existing test KB to ensure fresh state: {kb.name}")
            session.delete(kb)
            session.commit()
            kb = None

        if not kb:
            kb = KnowledgeBase(
                name=kb_name, user_id=user.id, embedding_model="text-embedding-3-small"
            )
            session.add(kb)
            session.commit()
            session.refresh(kb)

        # Ensure Document exists (Should always create new one since KB was recreated)
        doc = (
            session.query(Document)
            .filter(
                Document.knowledge_base_id == kb.id,
                Document.source_type == SourceType.DB,
            )
            .first()
        )

        if not doc:
            # Create a DB Document query to fetch users table (limit 5)
            # This config matches what DbProcessor expects
            source_config = {
                "connection_id": str(connection.id),
                "selections": [
                    {
                        "table_name": "users",
                        "columns": ["id", "email", "name"],
                        "template": "User: {{ name }} ({{ email }})",
                    }
                ],
            }
            doc = Document(
                knowledge_base_id=kb.id,
                filename="User DB Source",
                source_type=SourceType.DB,
                meta_info=source_config,
                status="pending",
            )
            session.add(doc)
            session.commit()
            session.refresh(doc)

        logger.info(f"Using KB: {kb.name} ({kb.id}), Doc: {doc.id}")
        logger.info(f"DOC META INFO: {doc.meta_info}")

        # 4. Construct Workflow Graph
        graph = {
            "nodes": [
                {
                    "id": "node-1",
                    "type": "llmNode",
                    "data": {"knowledgeBases": [{"id": str(kb.id), "name": kb.name}]},
                }
            ],
            "edges": [],
        }

        logger.info("Starting Sync (with mocked Embedding)...")

        # [Important] Mock EmbeddingService to avoid API Key requirement
        # We patch 'apps.shared.services.embedding_service.EmbeddingService.embed_batch' using patching on the IMPORTED service in VectorStoreService?
        # Actually it's easier to patch 'apps.shared.services.ingestion.vector_store_service.EmbeddingService'

        with patch(
            "apps.shared.services.ingestion.vector_store_service.EmbeddingService"
        ) as MockEmbeddingService:
            # Mock instance
            mock_instance = MockEmbeddingService.return_value
            # Mock get_client_for_user (returns simulated client)
            mock_instance.get_client_for_user.return_value = MagicMock()

            # Mock embed_batch: return dummy vectors of size 1536 (default for text-embedding-3-small)
            # It receives list of texts. Return list of lists of floats.
            def side_effect_embed(texts, model):
                logger.info(f"[Mock] Embedding {len(texts)} texts...")
                return [[0.1] * 1536 for _ in texts]

            mock_instance.embed_batch.side_effect = side_effect_embed

            # Instantiate SyncService
            syncer = SyncService(db=session, user_id=user.id)

            # Execute
            try:
                count = syncer.sync_knowledge_bases(graph)
                logger.info(f"Sync complete. Synced documents: {count}")

                if count > 0:
                    print(
                        "✅ E2E Sync Test Passed: Documents synced and chunks saved (Mocked Embedding)."
                    )
                else:
                    print(
                        "⚠️ E2E Sync Test Finished with 0 synced documents. Check logs for errors."
                    )

            except Exception as e:
                print(f"❌ E2E Sync Test Failed with Exception: {e}")
                # Print traceback if needed
                import traceback

                traceback.print_exc()

    except Exception as e:
        logger.error(f"Test Setup Failed: {e}")
        import traceback

        traceback.print_exc()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run_e2e_test()
