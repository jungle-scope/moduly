# 경로 설정
import os
import sys
import uuid
from unittest.mock import MagicMock

sys.path.append(os.path.abspath(os.curdir))


def verify_sync_service():
    print("Verifying SyncService imports and basic instantiation...")

    try:
        from apps.shared.services.ingestion.processors.db_processor import DbProcessor
        from apps.shared.services.ingestion.vector_store_service import (
            VectorStoreService,
        )
        from apps.workflow_engine.services.sync_service import SyncService

        print("[OK] Imports successful.")
    except ImportError as e:
        print(f"[FAIL] Import error: {e}")
        return

    # Mock DB Session
    mock_session = MagicMock()
    mock_user_id = uuid.uuid4()

    try:
        service = SyncService(db=mock_session, user_id=mock_user_id)
        if isinstance(service.db_processor, DbProcessor) and isinstance(
            service.vector_store_service, VectorStoreService
        ):
            print("[OK] SyncService instantiated correctly with dependencies.")
        else:
            print("[FAIL] SyncService dependencies not initialized correctly.")

    except Exception as e:
        print(f"[FAIL] Instantiation error: {e}")
        return

    print("Verification complete.")


if __name__ == "__main__":
    verify_sync_service()
