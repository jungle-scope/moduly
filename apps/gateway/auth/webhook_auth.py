"""
Webhook 인증 전략 패턴 모듈

다양한 Webhook 서비스(Slack, GitHub, Stripe 등)의 서로 다른 인증 방식(Header Key, Signature 등)을
유연하게 지원하기 위해 Strategy Pattern을 적용합니다.
"""

import abc
import hmac
import hashlib
import time
from typing import Optional

from fastapi import Request

from apps.shared.db.models.app import App


class WebhookAuthStrategy(abc.ABC):
    """Webhook 인증 전략 인터페이스"""

    @abc.abstractmethod
    async def verify(self, request: Request, app: App) -> bool:
        """
        요청의 인증 정보를 검증합니다.

        Args:
            request: FastAPI Request 객체
            app: App 모델 객체 (auth_secret 포함)

        Returns:
            bool: 인증 성공 여부
        """
        pass


class DefaultWebhookStrategy(WebhookAuthStrategy):
    """
    기본 Webhook 인증 전략

    지원 방식 (순차 검증):
    1. Query Parameter: ?token=xxx
    2. Authorization Header: Bearer xxx
    3. Custom Header: X-Webhook-Secret: xxx
    """

    async def verify(self, request: Request, app: App) -> bool:
        # 1. Query Parameter
        token = request.query_params.get("token")
        if token and token == app.auth_secret:
            return True

        # 2. Authorization Header (Bearer)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # "Bearer " 제거
            if token == app.auth_secret:
                return True

        # 3. Custom Header (X-Webhook-Secret)
        webhook_secret = request.headers.get("X-Webhook-Secret")
        if webhook_secret and webhook_secret == app.auth_secret:
            return True

        return False


class GitHubWebhookStrategy(WebhookAuthStrategy):
    """
    GitHub Webhook 인증 전략

    GitHub webhook signature 검증:
    - X-Hub-Signature-256 헤더를 사용한 HMAC SHA-256 검증
    - Fallback으로 X-Hub-Signature (SHA-1) 지원

    참고: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
    """

    def _verify_signature(self, payload_body: bytes, secret: str, signature: str, hash_func) -> bool:
        """
        HMAC 서명을 검증합니다.

        Args:
            payload_body: 원본 요청 body (bytes)
            secret: Webhook secret
            signature: 헤더에서 받은 서명 (sha256=... 형식)
            hash_func: hashlib 해시 함수 (hashlib.sha256 또는 hashlib.sha1)

        Returns:
            bool: 서명 검증 성공 여부
        """
        if not signature:
            return False

        # 서명 형식: "sha256=<hex_digest>" 또는 "sha1=<hex_digest>"
        try:
            algorithm, hex_digest = signature.split("=", 1)
        except ValueError:
            return False

        # HMAC 계산
        mac = hmac.new(secret.encode(), msg=payload_body, digestmod=hash_func)
        expected_signature = mac.hexdigest()

        # Timing attack 방지를 위한 constant-time 비교
        return hmac.compare_digest(expected_signature, hex_digest)

    async def verify(self, request: Request, app: App) -> bool:
        """
        GitHub webhook 서명을 검증합니다.

        우선순위:
        1. X-Hub-Signature-256 (SHA-256, 권장)
        2. X-Hub-Signature (SHA-1, 레거시 호환성)
        """
        # GitHub webhook 헤더 확인
        signature_256 = request.headers.get("X-Hub-Signature-256")
        signature_sha1 = request.headers.get("X-Hub-Signature")

        if not signature_256 and not signature_sha1:
            # GitHub 서명 헤더가 없으면 GitHub webhook이 아님
            return False

        payload_body = await request.body()

        if not payload_body:
            return False

        # 1. SHA-256 검증 (권장)
        if signature_256:
            if self._verify_signature(payload_body, app.auth_secret, signature_256, hashlib.sha256):
                return True

        # 2. SHA-1 검증 (레거시)
        if signature_sha1:
            if self._verify_signature(payload_body, app.auth_secret, signature_sha1, hashlib.sha1):
                return True

        return False


class SlackWebhookStrategy(WebhookAuthStrategy):
    """
    Slack Webhook 인증 전략

    Slack webhook signature 검증:
    - X-Slack-Signature 헤더를 사용한 HMAC SHA-256 검증
    - X-Slack-Request-Timestamp를 사용한 replay attack 방지
    - Basestring 형식: v0:{timestamp}:{request_body}

    참고: https://api.slack.com/authentication/verifying-requests-from-slack
    """

    # Replay attack 방지를 위한 타임스탬프 허용 범위 (초)
    TIMESTAMP_TOLERANCE = 60 * 5  # 5분

    def _is_timestamp_valid(self, timestamp: str) -> bool:
        """
        타임스탬프가 유효한 범위 내에 있는지 확인합니다.
        Replay attack 방지를 위해 5분 이내의 요청만 허용합니다.

        Args:
            timestamp: X-Slack-Request-Timestamp 헤더 값

        Returns:
            bool: 타임스탬프 유효 여부
        """
        try:
            request_timestamp = int(timestamp)
            current_timestamp = int(time.time())
            time_diff = abs(current_timestamp - request_timestamp)
            return time_diff < self.TIMESTAMP_TOLERANCE
        except (ValueError, TypeError):
            return False

    def _verify_signature(self, payload_body: bytes, secret: str, timestamp: str, signature: str) -> bool:
        """
        Slack HMAC 서명을 검증합니다.

        Args:
            payload_body: 원본 요청 body (bytes)
            secret: Slack Signing Secret
            timestamp: X-Slack-Request-Timestamp 헤더 값
            signature: X-Slack-Signature 헤더 값 (v0=... 형식)

        Returns:
            bool: 서명 검증 성공 여부
        """
        if not signature or not timestamp:
            return False

        # 서명 형식: "v0=<hex_digest>"
        if not signature.startswith("v0="):
            return False

        try:
            hex_digest = signature.split("=", 1)[1]
        except (ValueError, IndexError):
            return False

        # Basestring 생성: v0:{timestamp}:{request_body}
        basestring = f"v0:{timestamp}:{payload_body.decode('utf-8')}"

        # HMAC SHA-256 계산
        mac = hmac.new(
            secret.encode(),
            msg=basestring.encode(),
            digestmod=hashlib.sha256
        )
        expected_signature = mac.hexdigest()

        # Timing attack 방지를 위한 constant-time 비교
        return hmac.compare_digest(expected_signature, hex_digest)

    async def verify(self, request: Request, app: App) -> bool:
        """
        Slack webhook 서명을 검증합니다.

        검증 단계:
        1. X-Slack-Signature 및 X-Slack-Request-Timestamp 헤더 확인
        2. 타임스탬프 유효성 검증 (replay attack 방지)
        3. HMAC SHA-256 서명 검증
        """
        # Slack webhook 헤더 확인
        signature = request.headers.get("X-Slack-Signature")
        timestamp = request.headers.get("X-Slack-Request-Timestamp")

        if not signature or not timestamp:
            # Slack 서명 헤더가 없으면 Slack webhook이 아님
            return False

        # 1. 타임스탬프 유효성 검증 (replay attack 방지)
        if not self._is_timestamp_valid(timestamp):
            return False

        payload_body = await request.body()

        if not payload_body:
            return False

        # 2. HMAC SHA-256 서명 검증
        return self._verify_signature(payload_body, app.auth_secret, timestamp, signature)


class JiraWebhookStrategy(WebhookAuthStrategy):
    """
    Jira Webhook 인증 전략

    Jira webhook signature 검증:
    - X-Hub-Signature 헤더 사용 (GitHub와 동일한 헤더명)
    - HMAC SHA-256 서명 검증
    - 형식: sha256=<hex_digest>

    참고: https://developer.atlassian.com/cloud/jira/platform/webhooks/
    """

    def _verify_signature(self, payload_body: bytes, secret: str, signature: str) -> bool:
        """
        Jira HMAC 서명을 검증합니다.

        Args:
            payload_body: 원본 요청 body (bytes)
            secret: Jira Webhook Secret
            signature: X-Hub-Signature 헤더 값 (sha256=... 형식)

        Returns:
            bool: 서명 검증 성공 여부
        """
        if not signature:
            return False

        # 서명 형식: "sha256=<hex_digest>"
        if not signature.startswith("sha256="):
            return False

        try:
            hex_digest = signature.split("=", 1)[1]
        except (ValueError, IndexError):
            return False

        # HMAC SHA-256 계산
        mac = hmac.new(secret.encode(), msg=payload_body, digestmod=hashlib.sha256)
        expected_signature = mac.hexdigest()

        # Timing attack 방지를 위한 constant-time 비교
        return hmac.compare_digest(expected_signature, hex_digest)

    async def verify(self, request: Request, app: App) -> bool:
        """
        Jira webhook 서명을 검증합니다.

        검증 단계:
        1. X-Hub-Signature 헤더 확인
        2. Raw Body 추출
        3. HMAC SHA-256 서명 검증
        """
        # Jira webhook 헤더 확인
        signature = request.headers.get("X-Hub-Signature")

        if not signature:
            # Jira 서명 헤더가 없으면 Jira webhook이 아님
            return False

        payload_body = await request.body()

        if not payload_body:
            return False

        # HMAC SHA-256 서명 검증
        return self._verify_signature(payload_body, app.auth_secret, signature)


class AppWebhookAuthManager:
    """
    등록된 Webhook 인증 전략 목록을 순회하며 검증을 수행하는 관리자.

    DIP 적용: 구체적인 전략 클래스를 직접 생성하지 않고,
    외부에서 List[WebhookAuthStrategy] 형태로 주입받습니다.
    새로운 Webhook 전략을 추가할 때 이 클래스는 수정할 필요가 없습니다 (OCP 준수).
    """

    def __init__(self, strategies: list[WebhookAuthStrategy]):
        """
        Args:
            strategies: 순차적으로 시도할 WebhookAuthStrategy 인스턴스 리스트.
                        get_webhook_auth_manager() 팩토리 함수를 통해 주입됩니다.
        """
        self.strategies = strategies

    async def verify(self, request: Request, app: App) -> bool:
        """
        등록된 모든 인증 전략을 순차적으로 시도하여 검증합니다.
        하나라도 성공하면 True를 반환합니다.
        """
        for strategy in self.strategies:
            if await strategy.verify(request, app):
                return True

        return False


def get_webhook_auth_manager() -> AppWebhookAuthManager:
    """
    Webhook 인증 관리자를 생성하는 팩토리 함수.

    DIP의 조립(Composition) 책임을 이 함수가 전담합니다.
    FastAPI의 Depends()를 통해 엔드포인트에 주입됩니다.

    새로운 Webhook 서비스(예: Discord)를 지원하려면
    이 함수의 리스트에 전략을 추가하기만 하면 됩니다.
    """
    return AppWebhookAuthManager(
        strategies=[
            DefaultWebhookStrategy(),
            GitHubWebhookStrategy(),
            SlackWebhookStrategy(),
            JiraWebhookStrategy(),
        ]
    )
