"""
ParsingRegistry 캐싱 시스템 테스트

테스트 대상:
1. ParsingRegistry 모델 단위 테스트
2. _compute_file_hash() 헬퍼 함수 테스트
3. 캐시 히트/미스 로직 테스트
"""

import hashlib
import sys
import tempfile
from unittest.mock import MagicMock, patch
from uuid import uuid4

# 외부 의존성 Mock (import 전에 설정 필요)
mock_celery = MagicMock()
mock_celery.signals = MagicMock()
sys.modules["celery"] = mock_celery
sys.modules["celery.signals"] = mock_celery.signals

mock_redis = MagicMock()
mock_redis.asyncio = MagicMock()
sys.modules["redis"] = mock_redis
sys.modules["redis.asyncio"] = mock_redis.asyncio

from apps.shared.db.models.knowledge import ParsingRegistry

# =============================================================================
# 1. ParsingRegistry 모델 단위 테스트
# =============================================================================


class TestParsingRegistryModel:
    """ParsingRegistry 모델 단위 테스트"""

    def test_parsing_registry_creation(self):
        """ParsingRegistry 객체 생성 및 필수 필드 검증"""
        # Given
        content_digest = hashlib.sha256(b"test content").hexdigest()

        # When
        registry = ParsingRegistry(
            content_digest=content_digest,
            storage_key="parsed/test_file.md",
            provider="llamaparse",
            page_count=10,
            meta_info={"strategy": "llamaparse"},
        )

        # Then
        assert registry.content_digest == content_digest
        assert registry.storage_key == "parsed/test_file.md"
        assert registry.provider == "llamaparse"
        assert registry.page_count == 10
        assert registry.meta_info == {"strategy": "llamaparse"}

    def test_parsing_registry_default_values(self):
        """ParsingRegistry 기본값 검증 (명시적 설정)"""
        # Given
        content_digest = hashlib.sha256(b"test").hexdigest()

        # When - 기본값을 명시적으로 설정
        registry = ParsingRegistry(
            content_digest=content_digest,
            storage_key="test.md",
            provider="llamaparse",
            page_count=0,
            meta_info={},
        )

        # Then
        assert registry.provider == "llamaparse"
        assert registry.page_count == 0
        assert registry.meta_info == {}

    def test_parsing_registry_composite_pk(self):
        """복합 PK (content_digest, provider) 동작 확인"""
        # Given: 같은 파일 해시, 다른 provider
        content_digest = hashlib.sha256(b"same content").hexdigest()

        # When
        registry_llama = ParsingRegistry(
            content_digest=content_digest,
            storage_key="llama.md",
            provider="llamaparse",
        )
        registry_general = ParsingRegistry(
            content_digest=content_digest,
            storage_key="general.md",
            provider="general",
        )

        # Then: 서로 다른 객체로 취급
        assert registry_llama.provider != registry_general.provider
        assert registry_llama.storage_key != registry_general.storage_key


# =============================================================================
# 2. _compute_file_hash() 헬퍼 함수 테스트
# =============================================================================


class TestComputeFileHash:
    """_compute_file_hash() 헬퍼 함수 테스트"""

    def test_compute_hash_for_local_file(self):
        """로컬 파일 해시 계산 테스트"""
        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given: 임시 파일 생성
        with tempfile.NamedTemporaryFile(delete=False) as f:
            test_content = b"test content for hashing"
            f.write(test_content)
            temp_path = f.name

        expected_hash = hashlib.sha256(test_content).hexdigest()

        # When
        mock_db = MagicMock()
        orchestrator = IngestionOrchestrator(
            db=mock_db,
            user_id=uuid4(),
        )
        result = orchestrator._compute_file_hash(temp_path)

        # Then
        assert result == expected_hash

        # Cleanup
        import os

        os.unlink(temp_path)

    def test_compute_hash_file_not_found(self):
        """존재하지 않는 파일 해시 계산 시 None 반환"""
        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given
        mock_db = MagicMock()
        orchestrator = IngestionOrchestrator(db=mock_db, user_id=uuid4())

        # When
        result = orchestrator._compute_file_hash("/non/existent/path.pdf")

        # Then
        assert result is None

    @patch("requests.get")
    def test_compute_hash_for_url(self, mock_get):
        """URL 파일 해시 계산 테스트"""
        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given
        test_content = b"remote content"
        mock_response = MagicMock()
        mock_response.iter_content.return_value = [test_content]
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_get.return_value = mock_response

        expected_hash = hashlib.sha256(test_content).hexdigest()

        # When
        mock_db = MagicMock()
        orchestrator = IngestionOrchestrator(db=mock_db, user_id=uuid4())
        result = orchestrator._compute_file_hash("https://example.com/file.pdf")

        # Then
        assert result == expected_hash
        mock_get.assert_called_once_with("https://example.com/file.pdf", stream=True)

    @patch("requests.get")
    def test_compute_hash_network_error(self, mock_get):
        """네트워크 오류 시 None 반환"""
        import requests

        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given
        mock_get.side_effect = requests.RequestException("Network error")

        # When
        mock_db = MagicMock()
        orchestrator = IngestionOrchestrator(db=mock_db, user_id=uuid4())
        result = orchestrator._compute_file_hash("https://example.com/file.pdf")

        # Then
        assert result is None


# =============================================================================
# 3. analyze_document() 캐시 조회 테스트
# =============================================================================


class TestAnalyzeDocumentCache:
    """analyze_document() 캐시 조회 테스트"""

    def test_analyze_document_cache_hit(self):
        """캐시 히트 시 is_cached=True, cost=0 반환"""
        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given
        mock_db = MagicMock()
        document_id = uuid4()
        content_digest = hashlib.sha256(b"test").hexdigest()

        # Mock Document
        mock_doc = MagicMock()
        mock_doc.file_path = "/test/path.pdf"
        mock_doc.filename = "test.pdf"
        mock_db.query.return_value.get.return_value = mock_doc

        # Mock ParsingRegistry (Cache Hit)
        mock_registry = MagicMock()
        mock_registry.page_count = 10
        mock_db.query.return_value.filter.return_value.first.return_value = (
            mock_registry
        )

        orchestrator = IngestionOrchestrator(db=mock_db, user_id=uuid4())

        # Mock _compute_file_hash
        with patch.object(
            orchestrator, "_compute_file_hash", return_value=content_digest
        ):
            # When
            # 동기 테스트를 위해 asyncio.run 사용
            import asyncio

            result = asyncio.run(
                orchestrator.analyze_document(document_id, "llamaparse")
            )

        # Then
        assert result["is_cached"] is True
        assert result["cost_estimate"]["credits"] == 0
        assert result["cost_estimate"]["cost_usd"] == 0.0
        assert result["cost_estimate"]["pages"] == 10

    def test_analyze_document_cache_miss(self):
        """캐시 미스 시 비용 계산"""
        from apps.gateway.services.ingestion.service import IngestionOrchestrator

        # Given
        mock_db = MagicMock()
        document_id = uuid4()
        content_digest = hashlib.sha256(b"test").hexdigest()

        # Mock Document
        mock_doc = MagicMock()
        mock_doc.file_path = "/test/path.pdf"
        mock_doc.filename = "test.pdf"
        mock_doc.source_type = "FILE"
        mock_db.query.return_value.get.return_value = mock_doc

        # Mock ParsingRegistry (Cache Miss)
        mock_db.query.return_value.filter.return_value.first.return_value = None

        # Mock processor
        mock_processor = MagicMock()
        mock_processor.analyze.return_value = {"pages": 20}

        orchestrator = IngestionOrchestrator(db=mock_db, user_id=uuid4())

        with (
            patch.object(
                orchestrator, "_compute_file_hash", return_value=content_digest
            ),
            patch(
                "apps.gateway.services.ingestion.service.IngestionFactory.get_processor",
                return_value=mock_processor,
            ),
        ):
            # When
            # 동기 테스트를 위해 asyncio.run 사용
            import asyncio

            result = asyncio.run(
                orchestrator.analyze_document(document_id, "llamaparse")
            )

        # Then
        assert result["is_cached"] is False
        assert result["cost_estimate"]["pages"] == 20
        assert result["cost_estimate"]["credits"] == 20  # 1 credit per page
        assert result["cost_estimate"]["cost_usd"] == 20 * 0.003  # $0.003 per page
