import logging
import os
import sys
from typing import Any, Dict
from unittest.mock import MagicMock, patch

# 경로 설정
sys.path.append(os.path.abspath(os.curdir))
# sys.path.append(os.path.abspath(os.path.join(os.curdir, "apps/workflow_engine"))) # Removed workflow.core dependency

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from dotenv import load_dotenv

load_dotenv()

from apps.gateway.utils.encryption import encryption_manager
from apps.shared.db.models.connection import Connection
from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.db.models.user import User
from apps.shared.db.session import SessionLocal
from apps.workflow_engine.services.sync_service import SyncService


class MockWorkflowEngine:
    def __init__(self, **kwargs):
        pass

    async def execute(self):
        return {"result": "Simulated Execution Success"}


WorkflowEngine = MockWorkflowEngine


def simulate_workflow_execution(session, user_id, graph) -> Dict[str, Any]:
    """
    apps/workflow_engine/tasks.py 의 execute_workflow 로직을 시뮬레이션
    """
    logger.info(">>> [Simulated Task] Starting Workflow Execution...")

    # [1] Sync Hook
    try:
        logger.info(">>> [Simulated Task] Triggering Sync Hook...")
        syncer = SyncService(db=session, user_id=user_id)
        count = syncer.sync_knowledge_bases(graph)
        logger.info(f">>> [Simulated Task] Sync Hook Complete. Processed: {count}")
    except Exception as e:
        logger.error(f">>> [Simulated Task] Sync Hook Failed: {e}")

    # [2] Workflow Engine Execution
    engine = WorkflowEngine(
        graph=graph,
        user_input={},
        execution_context={"user_id": str(user_id)},
        is_deployed=False,
        db=session,
    )
    return {"status": "simulated_success", "synced_count": count}


def run_integration_test():
    """
    Integration Test:
    1. Setup DB Data (User A)
    2. Run Workflow (Sync -> Check Chunks)
    3. Modify DB Data (User A -> name changed)
    4. Run Workflow again (Sync -> Check Chunks updated)
    """

    session = SessionLocal()

    try:
        # Pre-check: LLM Credential (Mocking needed for SyncService embedding)

        # 1. User Setup
        user = session.query(User).filter(User.email == "integration@moduly.ai").first()
        if not user:
            user = User(
                email="integration@moduly.ai",
                password="hashed",
                name="Integration User",
                social_provider="email",
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        logger.info(f"Using User: {user.email}")

        # 2. Connection Setup (Postgres Local)
        conn_name = "integration-local-db"
        connection = (
            session.query(Connection)
            .filter(Connection.name == conn_name, Connection.user_id == user.id)
            .first()
        )
        # .env info
        db_user = os.getenv("DB_USER", "moduly")
        db_password = os.getenv("DB_PASSWORD", "moduly")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = int(os.getenv("DB_PORT", 5432))
        db_name = os.getenv("DB_NAME", "moduly_local")

        if not connection:
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

        # 3. KB & Document Setup
        kb_name = "Integration KB"
        kb = (
            session.query(KnowledgeBase)
            .filter(KnowledgeBase.name == kb_name, KnowledgeBase.user_id == user.id)
            .first()
        )
        if kb:
            session.delete(kb)  # Fresh start
            session.commit()

        kb = KnowledgeBase(
            name=kb_name, user_id=user.id, embedding_model="text-embedding-3-small"
        )
        session.add(kb)
        session.commit()
        session.refresh(kb)

        # 4. Prepare Mock Data Table (Using 'users' table, but we will filter by specific email to simulate 'changing data')

        target_email = "target_data@moduly.ai"
        target_user = session.query(User).filter(User.email == target_email).first()
        if target_user:
            session.delete(target_user)
            session.commit()

        target_user = User(
            email=target_email,
            password="pwd",
            name="Original Name",  # State A
            social_provider="email",
        )
        session.add(target_user)
        session.commit()
        logger.info(f"State A: Created target user '{target_user.name}' in DB.")

        source_config = {
            "connection_id": str(connection.id),
            "selections": [
                {
                    "table_name": "users",
                    "columns": ["email", "name"],
                    "template": "Target: {{ name }} ({{ email }})",
                }
            ],
            "limit": 1000,
        }

        doc = Document(
            knowledge_base_id=kb.id,
            filename="User Data Source",
            source_type=SourceType.DB,
            meta_info=source_config,
            status="pending",
        )
        session.add(doc)
        session.commit()

        # Graph
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

        # Helper to decrypt chunk
        def get_decrypted_content(c):
            try:
                return encryption_manager.decrypt(c.content)
            except:
                return c.content

        # Mock Embedding
        with patch(
            "apps.shared.services.ingestion.vector_store_service.EmbeddingService"
        ) as MockEmbed:
            mock_inst = MockEmbed.return_value
            mock_inst.get_client_for_user.return_value = MagicMock()

            # Fix: accept 'model' keyword argument
            mock_inst.embed_batch.side_effect = lambda texts, model=None: [
                [0.1] * 1536 for _ in texts
            ]

            # === Step 1: Run Workflow (State A) ===
            logger.info("=== Executing Workflow (State A) ===")
            res = simulate_workflow_execution(session, user.id, graph)

            # Verify Chunk for Target User
            from apps.shared.db.models.knowledge import DocumentChunk

            chunks_a = (
                session.query(DocumentChunk)
                .filter(DocumentChunk.document_id == doc.id)
                .all()
            )

            found_a = False
            for c in chunks_a:
                decrypted = get_decrypted_content(c)
                if "Target: Original Name" in decrypted:
                    found_a = True
                    break

            if found_a:
                print("✅ State A Verification: Found chunk with 'Original Name'.")
            else:
                print("❌ State A Verification: Chunk with 'Original Name' NOT found.")
                for c in chunks_a[:5]:
                    logger.info(
                        f"Chunk content (decrypted): {get_decrypted_content(c)}"
                    )

            # === Step 2: Update Data (State B) ===
            logger.info("=== Updating DB Data (State B) ===")
            target_user.name = "Updated Name"
            session.add(target_user)
            session.commit()
            logger.info(f"State B: Updated target user to '{target_user.name}' in DB.")

            # === Step 3: Run Workflow (State B) ===
            logger.info("=== Executing Workflow (State B) ===")
            res_b = simulate_workflow_execution(session, user.id, graph)

            # Verify Chunk for Target User
            chunks_b = (
                session.query(DocumentChunk)
                .filter(DocumentChunk.document_id == doc.id)
                .all()
            )

            found_b = False
            for c in chunks_b:
                decrypted = get_decrypted_content(c)
                if "Target: Updated Name" in decrypted:
                    found_b = True
                    break

            if found_b:
                print("✅ State B Verification: Found chunk with 'Updated Name'.")
            else:
                print("❌ State B Verification: Chunk with 'Updated Name' NOT found.")
                for c in chunks_b[:5]:
                    logger.info(
                        f"Chunk content (decrypted): {get_decrypted_content(c)}"
                    )

            if found_a and found_b:
                print("🎉 Integration Test Passed: Data change reflected in sync!")

    except Exception as e:
        logger.error(f"Test Failed: {e}")
        import traceback

        traceback.print_exc()
    finally:
        # Cleanup
        try:
            if "target_user" in locals() and target_user:
                session.delete(target_user)
            if "kb" in locals() and kb:
                session.delete(kb)  # Cascades to doc/chunks
            session.commit()
        except:
            pass
        session.close()


if __name__ == "__main__":
    run_integration_test()
