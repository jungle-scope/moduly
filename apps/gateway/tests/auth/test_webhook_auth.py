
import hmac
import hashlib
from unittest.mock import Mock

import pytest
from fastapi import Request

from apps.gateway.auth.webhook_auth import DefaultWebhookStrategy
from apps.shared.db.models.app import App



@pytest.mark.asyncio
class TestDefaultWebhookStrategy:
    @pytest.fixture
    def strategy(self):
        return DefaultWebhookStrategy()

    @pytest.fixture
    def app(self):
        mock_app = Mock(spec=App)
        mock_app.auth_secret = "test-secret"
        return mock_app

    async def test_verify_query_param(self, strategy, app):
        """Query Parameter 인증 테스트"""
        scope = {
            "type": "http",
            "query_string": b"token=test-secret",
            "headers": [],
        }
        request = Request(scope)
        assert await strategy.verify(request, app) is True

    async def test_verify_bearer_token(self, strategy, app):
        """Bearer Token 인증 테스트"""
        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"authorization", b"Bearer test-secret")],
        }
        request = Request(scope)
        assert await strategy.verify(request, app) is True

    async def test_verify_custom_header(self, strategy, app):
        """Custom Header 인증 테스트"""
        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-webhook-secret", b"test-secret")],
        }
        request = Request(scope)
        assert await strategy.verify(request, app) is True

    async def test_verify_fail(self, strategy, app):
        """인증 실패 테스트"""
        # 1. 토큰 없음
        scope_no_token = {
            "type": "http",
            "query_string": b"",
            "headers": [],
        }
        assert await strategy.verify(Request(scope_no_token), app) is False

        # 2. 잘못된 토큰 (Query)
        scope_wrong_query = {
            "type": "http",
            "query_string": b"token=wrong-secret",
            "headers": [],
        }
        assert await strategy.verify(Request(scope_wrong_query), app) is False

        # 3. 잘못된 토큰 (Bearer)
        scope_wrong_bearer = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"authorization", b"Bearer wrong-secret")],
        }
        assert await strategy.verify(Request(scope_wrong_bearer), app) is False
