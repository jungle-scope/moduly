import unittest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.v1.endpoints.webhook import CAPTURE_SESSIONS
from apps.shared.db.session import get_db
from main import app


class TestWebhookApi(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.url_slug = "test-slug"
        self.auth_secret = "secret123"

        # 캡처 세션 초기화
        CAPTURE_SESSIONS.clear()

    def test_capture_lifecycle(self):
        """캡처 시작 -> 웹훅 수신 -> 상태 조회 시나리오 테스트"""

        # 1. DB Mock 설정 (App 조회용)
        mock_db_session = MagicMock()
        mock_app = MagicMock()
        mock_app.url_slug = self.url_slug
        mock_app.auth_secret = self.auth_secret

        # db.query(App).filter(...).first() 체인 Mocking
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            mock_app
        )

        # get_db 의존성 오버라이드
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            # === Step 1: 캡처 시작 ===
            response = self.client.get(f"/api/v1/hooks/{self.url_slug}/capture/start")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "waiting")

            # 메모리에 세션 생성 확인
            self.assertIn(self.url_slug, CAPTURE_SESSIONS)
            self.assertEqual(CAPTURE_SESSIONS[self.url_slug]["status"], "waiting")

            # === Step 2: Webhook 수신 (캡처 모드) ===
            payload = {"event": "test", "data": 123}
            response = self.client.post(
                f"/api/v1/hooks/{self.url_slug}?token={self.auth_secret}", json=payload
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "captured")

            # === Step 3: 캡처 상태 조회 ===
            response = self.client.get(f"/api/v1/hooks/{self.url_slug}/capture/status")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "captured")
            self.assertEqual(data["payload"]["event"], "test")

            # 조회 후 메모리에서 삭제되었는지 확인
            self.assertNotIn(self.url_slug, CAPTURE_SESSIONS)

        finally:
            app.dependency_overrides = {}

    def test_webhook_invalid_token(self):
        """잘못된 토큰으로 웹훅 수신 시 거부 테스트"""
        mock_db_session = MagicMock()
        mock_app = MagicMock()
        mock_app.auth_secret = self.auth_secret
        mock_db_session.query.return_value.filter.return_value.first.return_value = (
            mock_app
        )

        # get_db 의존성 오버라이드
        app.dependency_overrides[get_db] = lambda: mock_db_session

        try:
            response = self.client.post(
                f"/api/v1/hooks/{self.url_slug}?token=wrong-token", json={}
            )
            self.assertEqual(response.status_code, 403)
        finally:
            app.dependency_overrides = {}


if __name__ == "__main__":
    unittest.main()
