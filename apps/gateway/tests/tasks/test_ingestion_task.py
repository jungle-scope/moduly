# Ingestion Task Tests
import uuid
from unittest.mock import MagicMock, patch

import pytest

# Celery Task 객체가 아닌 내부 로직 함수를 직접 테스트
from apps.gateway.tasks.ingestion import _run_ingestion_process as parse_document


@pytest.fixture
def mock_db_session():
    with patch("apps.gateway.tasks.ingestion.SessionLocal") as mock:
        session = MagicMock()
        mock.return_value = session
        yield session


@patch("apps.gateway.services.ingestion.service.IngestionOrchestrator")
def test_parse_document_success(mock_orchestrator_cls, mock_db_session):
    # Given
    document_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Mock DB Query Result
    # spec=Document 등을 사용하면 metaclass conflict가 발생할 수 있으므로 제거
    mock_doc = MagicMock()
    mock_doc.id = document_id
    mock_doc.knowledge_base = MagicMock()
    mock_doc.knowledge_base.user_id = user_id

    mock_db_session.query.return_value.join.return_value.filter.return_value.first.return_value = mock_doc

    # Mock Service
    mock_service_instance = mock_orchestrator_cls.return_value

    # When
    result = parse_document(document_id)

    # Then
    # 1. DB에서 문서 조회가 수행되었는지 확인
    mock_db_session.query.assert_called()

    # 2. 서비스가 올바른 user_id로 초기화되었는지 확인
    mock_orchestrator_cls.assert_called_with(db=mock_db_session, user_id=user_id)

    # 3. process_document가 호출되었는지 확인
    mock_service_instance.process_document.assert_called_with(document_id=document_id)

    assert result == {"status": "success", "document_id": str(document_id)}


@patch("apps.gateway.services.ingestion.service.IngestionOrchestrator")
def test_parse_document_doc_not_found(mock_orchestrator_cls, mock_db_session):
    # Given
    document_id = uuid.uuid4()

    # Mock DB returns None
    mock_db_session.query.return_value.join.return_value.filter.return_value.first.return_value = None

    # When
    result = parse_document(document_id)

    # Then
    # 서비스가 생성되거나 호출되지 않아야 함
    mock_orchestrator_cls.assert_not_called()
    assert result is None  # Return None when doc not found
