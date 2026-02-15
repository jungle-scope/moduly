
import hmac
import hashlib
import time
from unittest.mock import Mock

import pytest
from fastapi import Request

from apps.gateway.auth.webhook_auth import SlackWebhookStrategy
from apps.shared.db.models.app import App


@pytest.mark.asyncio
class TestSlackWebhookStrategy:
    @pytest.fixture
    def strategy(self):
        return SlackWebhookStrategy()

    @pytest.fixture
    def app(self):
        mock_app = Mock(spec=App)
        mock_app.auth_secret = "slack-signing-secret"
        return mock_app

    def _create_slack_signature(self, payload: bytes, secret: str, timestamp: str) -> str:
        """테스트용 Slack HMAC 서명 생성 헬퍼 함수"""
        basestring = f"v0:{timestamp}:{payload.decode('utf-8')}"
        mac = hmac.new(
            secret.encode(),
            msg=basestring.encode(),
            digestmod=hashlib.sha256
        )
        return f"v0={mac.hexdigest()}"

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

    async def test_verify_valid_signature(self, strategy, app):
        """유효한 Slack 서명 검증 테스트"""
        payload = b'{"type":"url_verification","challenge":"test123"}'
        timestamp = str(int(time.time()))
        signature = self._create_slack_signature(payload, app.auth_secret, timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True

    async def test_verify_invalid_signature(self, strategy, app):
        """잘못된 서명 검증 실패 테스트"""
        payload = b'{"type":"event_callback","event":{"type":"message"}}'
        timestamp = str(int(time.time()))
        # 잘못된 secret으로 서명 생성
        wrong_signature = self._create_slack_signature(payload, "wrong-secret", timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", wrong_signature.encode()),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_expired_timestamp(self, strategy, app):
        """만료된 타임스탬프 검증 실패 테스트 (replay attack 방지)"""
        payload = b'{"type":"event_callback"}'
        # 6분 전 타임스탬프 (허용 범위: 5분)
        old_timestamp = str(int(time.time()) - 360)
        signature = self._create_slack_signature(payload, app.auth_secret, old_timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", old_timestamp.encode()),
            ],
            payload,
        )

        # 타임스탬프가 만료되어 검증 실패
        assert await strategy.verify(request, app) is False

    async def test_verify_future_timestamp(self, strategy, app):
        """미래 타임스탬프 검증 실패 테스트"""
        payload = b'{"type":"event_callback"}'
        # 6분 후 타임스탬프
        future_timestamp = str(int(time.time()) + 360)
        signature = self._create_slack_signature(payload, app.auth_secret, future_timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", future_timestamp.encode()),
            ],
            payload,
        )

        # 미래 타임스탬프도 허용 범위를 벗어나면 실패
        assert await strategy.verify(request, app) is False

    async def test_verify_timestamp_within_tolerance(self, strategy, app):
        """허용 범위 내 타임스탬프 검증 성공 테스트"""
        payload = b'{"type":"event_callback"}'
        # 4분 전 타임스탬프 (허용 범위: 5분)
        valid_timestamp = str(int(time.time()) - 240)
        signature = self._create_slack_signature(payload, app.auth_secret, valid_timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", valid_timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True

    async def test_verify_no_slack_headers(self, strategy, app):
        """Slack 헤더가 없을 때 검증 실패"""
        request = self._make_request(
            [(b"authorization", b"Bearer some-token")],
            b'{"test": "data"}',
        )

        # Slack 서명 헤더가 없으면 False 반환 (다른 전략이 처리)
        assert await strategy.verify(request, app) is False

    async def test_verify_missing_signature(self, strategy, app):
        """서명 헤더만 없을 때 검증 실패"""
        timestamp = str(int(time.time()))

        request = self._make_request(
            [(b"x-slack-request-timestamp", timestamp.encode())],
            b'{"type":"event_callback"}',
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_missing_timestamp(self, strategy, app):
        """타임스탬프 헤더만 없을 때 검증 실패"""
        payload = b'{"type":"event_callback"}'
        timestamp = str(int(time.time()))
        signature = self._create_slack_signature(payload, app.auth_secret, timestamp)

        request = self._make_request(
            [(b"x-slack-signature", signature.encode())],
            payload,
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_malformed_signature(self, strategy, app):
        """잘못된 형식의 서명 검증 실패"""
        payload = b'{"type":"event_callback"}'
        timestamp = str(int(time.time()))

        request = self._make_request(
            [
                (b"x-slack-signature", b"invalid-signature-format"),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_invalid_timestamp_format(self, strategy, app):
        """잘못된 타임스탬프 형식 검증 실패"""
        payload = b'{"type":"event_callback"}'
        invalid_timestamp = "not-a-number"
        signature = self._create_slack_signature(payload, app.auth_secret, invalid_timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", invalid_timestamp.encode()),
            ],
            payload,
        )

        # 타임스탬프가 숫자가 아니면 검증 실패
        assert await strategy.verify(request, app) is False

    async def test_verify_empty_body(self, strategy, app):
        """빈 body일 때 검증 실패"""
        timestamp = str(int(time.time()))
        signature = self._create_slack_signature(b"", app.auth_secret, timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            b'',  # 빈 body
        )

        assert await strategy.verify(request, app) is False

    async def test_verify_url_verification_challenge(self, strategy, app):
        """Slack URL verification challenge 검증 테스트"""
        # Slack 앱 설정 시 처음 받는 URL verification 요청
        payload = b'{"token":"verification_token","challenge":"3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXAYM8P","type":"url_verification"}'
        timestamp = str(int(time.time()))
        signature = self._create_slack_signature(payload, app.auth_secret, timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True

    async def test_verify_event_callback(self, strategy, app):
        """Slack event callback 검증 테스트"""
        payload = b'{"token":"token","team_id":"T123","api_app_id":"A123","event":{"type":"message","channel":"C123","user":"U123","text":"Hello"},"type":"event_callback"}'
        timestamp = str(int(time.time()))
        signature = self._create_slack_signature(payload, app.auth_secret, timestamp)

        request = self._make_request(
            [
                (b"x-slack-signature", signature.encode()),
                (b"x-slack-request-timestamp", timestamp.encode()),
            ],
            payload,
        )

        assert await strategy.verify(request, app) is True
