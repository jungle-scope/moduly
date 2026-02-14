
import hmac
import hashlib
from unittest.mock import Mock

import pytest
from fastapi import Request

from apps.gateway.auth.webhook_auth import JiraWebhookStrategy
from apps.shared.db.models.app import App


class TestJiraWebhookStrategy:
    @pytest.fixture
    def strategy(self):
        return JiraWebhookStrategy()

    @pytest.fixture
    def app(self):
        mock_app = Mock(spec=App)
        mock_app.auth_secret = "my-jira-secret"
        return mock_app

    def _create_signature(self, payload: bytes, secret: str) -> str:
        """테스트용 Jira HMAC SHA-256 서명 생성 헬퍼 함수"""
        mac = hmac.new(secret.encode(), msg=payload, digestmod=hashlib.sha256)
        return f"sha256={mac.hexdigest()}"

    def test_verify_valid_signature(self, strategy, app):
        """유효한 서명 검증 테스트"""
        payload = b'{"webhookEvent": "jira:issue_created", "issue": {"key": "TEST-1"}}'
        signature = self._create_signature(payload, app.auth_secret)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [
                (b"x-hub-signature", signature.encode()),
                (b"x-atlassian-webhook-identifier", b"550e8400-e29b-41d4-a716-446655440000"),
            ],
        }
        request = Request(scope)
        request._body = payload  # FastAPI 내부 캐시 시뮬레이션

        assert strategy.verify(request, app) is True

    def test_verify_invalid_signature(self, strategy, app):
        """잘못된 서명 검증 실패 테스트"""
        payload = b'{"webhookEvent": "jira:issue_created", "issue": {"key": "TEST-1"}}'
        # 잘못된 secret으로 서명 생성
        wrong_signature = self._create_signature(payload, "wrong-secret")

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", wrong_signature.encode())],
        }
        request = Request(scope)
        request._body = payload

        assert strategy.verify(request, app) is False

    def test_verify_no_jira_headers(self, strategy, app):
        """Jira 헤더가 없을 때 검증 실패"""
        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"authorization", b"Bearer some-token")],
        }
        request = Request(scope)
        request._body = b'{"test": "data"}'

        # Jira 서명 헤더가 없으면 False 반환 (다른 전략이 처리)
        assert strategy.verify(request, app) is False

    def test_verify_malformed_signature(self, strategy, app):
        """잘못된 형식의 서명 검증 실패"""
        payload = b'{"webhookEvent": "jira:issue_created"}'

        # "sha256=" 없는 잘못된 형식
        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", b"invalid-signature-format")],
        }
        request = Request(scope)
        request._body = payload

        assert strategy.verify(request, app) is False

    def test_verify_empty_body(self, strategy, app):
        """빈 body일 때 검증 실패"""
        signature = self._create_signature(b"", app.auth_secret)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", signature.encode())],
        }
        request = Request(scope)
        request._body = b''  # 빈 body

        assert strategy.verify(request, app) is False

    def test_verify_issue_created_event(self, strategy, app):
        """Issue 생성 이벤트 검증 테스트"""
        payload = b'''{
            "timestamp": 1234567890,
            "webhookEvent": "jira:issue_created",
            "issue_event_type_name": "issue_created",
            "issue": {
                "id": "10000",
                "key": "TEST-1",
                "fields": {
                    "summary": "Test Issue",
                    "issuetype": {"name": "Bug"}
                }
            }
        }'''
        signature = self._create_signature(payload, app.auth_secret)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [
                (b"x-hub-signature", signature.encode()),
                (b"x-atlassian-webhook-identifier", b"abc123-def456"),
            ],
        }
        request = Request(scope)
        request._body = payload

        assert strategy.verify(request, app) is True

    def test_verify_issue_updated_event(self, strategy, app):
        """Issue 업데이트 이벤트 검증 테스트"""
        payload = b'''{
            "timestamp": 1234567890,
            "webhookEvent": "jira:issue_updated",
            "issue_event_type_name": "issue_generic",
            "issue": {
                "id": "10000",
                "key": "TEST-1",
                "fields": {
                    "summary": "Updated Test Issue",
                    "status": {"name": "In Progress"}
                }
            },
            "changelog": {
                "items": [
                    {
                        "field": "status",
                        "fromString": "To Do",
                        "toString": "In Progress"
                    }
                ]
            }
        }'''
        signature = self._create_signature(payload, app.auth_secret)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", signature.encode())],
        }
        request = Request(scope)
        request._body = payload

        assert strategy.verify(request, app) is True

    def test_verify_comment_created_event(self, strategy, app):
        """코멘트 생성 이벤트 검증 테스트"""
        payload = b'''{
            "timestamp": 1234567890,
            "webhookEvent": "comment_created",
            "comment": {
                "id": "10100",
                "body": "This is a test comment",
                "author": {
                    "displayName": "Test User"
                }
            },
            "issue": {
                "id": "10000",
                "key": "TEST-1"
            }
        }'''
        signature = self._create_signature(payload, app.auth_secret)

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", signature.encode())],
        }
        request = Request(scope)
        request._body = payload

        assert strategy.verify(request, app) is True

    def test_verify_wrong_algorithm(self, strategy, app):
        """SHA-1 형식 거부 테스트"""
        payload = b'{"webhookEvent": "jira:issue_created"}'
        # SHA-1로 서명 생성
        mac = hmac.new(app.auth_secret.encode(), msg=payload, digestmod=hashlib.sha1)
        sha1_signature = f"sha1={mac.hexdigest()}"

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [(b"x-hub-signature", sha1_signature.encode())],
        }
        request = Request(scope)
        request._body = payload

        # SHA-1 형식은 거부되어야 함
        assert strategy.verify(request, app) is False

    def test_verify_identifier_header_present(self, strategy, app):
        """X-Atlassian-Webhook-Identifier 헤더 존재 확인"""
        payload = b'{"webhookEvent": "jira:issue_created", "issue": {"key": "TEST-1"}}'
        signature = self._create_signature(payload, app.auth_secret)
        webhook_id = "550e8400-e29b-41d4-a716-446655440000"

        scope = {
            "type": "http",
            "query_string": b"",
            "headers": [
                (b"x-hub-signature", signature.encode()),
                (b"x-atlassian-webhook-identifier", webhook_id.encode()),
            ],
        }
        request = Request(scope)
        request._body = payload

        # 서명 검증 성공 (identifier는 현재 검증하지 않지만 존재 확인)
        assert strategy.verify(request, app) is True
        # Identifier 헤더가 존재하는지 확인
        assert request.headers.get("X-Atlassian-Webhook-Identifier") == webhook_id
