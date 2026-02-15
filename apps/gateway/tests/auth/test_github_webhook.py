
import hmac
import hashlib
from unittest.mock import Mock

import pytest
from fastapi import Request

from apps.gateway.auth.webhook_auth import GitHubWebhookStrategy
from apps.shared.db.models.app import App


@pytest.mark.asyncio
class TestGitHubWebhookStrategy:
    @pytest.fixture
    def strategy(self):
        return GitHubWebhookStrategy()

    @pytest.fixture
    def app(self):
        mock_app = Mock(spec=App)
        mock_app.auth_secret = "my-secret-key"
        return mock_app

    def _create_signature(self, payload: bytes, secret: str, algorithm="sha256") -> str:
        """테스트용 HMAC 서명 생성 헬퍼 함수"""
        hash_func = hashlib.sha256 if algorithm == "sha256" else hashlib.sha1
        mac = hmac.new(secret.encode(), msg=payload, digestmod=hash_func)
        return f"{algorithm}={mac.hexdigest()}"

    def _make_request(self, headers: list, payload: bytes) -> Request:
        """테스트용 Request 객체 생성 헬퍼"""
        scope = {
            "type": "http",
            "query_string": b"",
            "headers": headers,
        }
        request = Request(scope)
        async def receive():
            return {"type": "http.request", "body": payload}
        request._receive = receive
        return request

    async def test_verify_sha256_signature(self, strategy, app):
        """SHA-256 서명 검증 테스트"""
        payload = b'{"action": "opened", "number": 1}'
        signature = self._create_signature(payload, app.auth_secret, "sha256")

        request = self._make_request(
            [
                (b"x-hub-signature-256", signature.encode()),
                (b"x-github-event", b"pull_request"),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True

    async def test_verify_sha1_signature(self, strategy, app):
        """SHA-1 서명 검증 테스트 (레거시)"""
        payload = b'{"action": "opened", "number": 1}'
        signature = self._create_signature(payload, app.auth_secret, "sha1")

        request = self._make_request(
            [
                (b"x-hub-signature", signature.encode()),
                (b"x-github-event", b"pull_request"),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True

    async def test_verify_both_signatures_sha256_priority(self, strategy, app):
        """SHA-256과 SHA-1 둘 다 있을 때 SHA-256 우선 검증"""
        payload = b'{"action": "opened", "number": 1}'
        signature_256 = self._create_signature(payload, app.auth_secret, "sha256")
        signature_sha1 = self._create_signature(payload, "wrong-secret", "sha1")  # 잘못된 SHA-1

        request = self._make_request(
            [
                (b"x-hub-signature-256", signature_256.encode()),
                (b"x-hub-signature", signature_sha1.encode()),
            ],
            payload,
        )

        # SHA-256이 올바르면 SHA-1이 틀려도 성공
        assert await strategy.verify(request, app) is True

    async def test_verify_invalid_signature(self, strategy, app):
        """잘못된 서명 검증 실패 테스트"""
        payload = b'{"action": "opened", "number": 1}'
        # 잘못된 secret으로 서명 생성
        wrong_signature = self._create_signature(payload, "wrong-secret", "sha256")

        request = self._make_request(
            [(b"x-hub-signature-256", wrong_signature.encode())],
            payload,
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_no_github_headers(self, strategy, app):
        """GitHub 헤더가 없을 때 검증 실패"""
        request = self._make_request(
            [(b"authorization", b"Bearer some-token")],
            b'{"test": "data"}',
        )

        # GitHub 서명 헤더가 없으면 False 반환 (다른 전략이 처리)
        assert await strategy.verify(request, app) is False

    async def test_verify_malformed_signature(self, strategy, app):
        """잘못된 형식의 서명 검증 실패"""
        payload = b'{"action": "opened"}'

        request = self._make_request(
            [(b"x-hub-signature-256", b"invalid-signature-format")],
            payload,
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_empty_body(self, strategy, app):
        """빈 body일 때 검증 실패"""
        signature = self._create_signature(b"", app.auth_secret, "sha256")

        request = self._make_request(
            [(b"x-hub-signature-256", signature.encode())],
            b'',  # 빈 body
        )

        assert await strategy.verify(request, app) is False
