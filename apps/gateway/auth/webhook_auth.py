"""
Webhook 인증 전략 패턴 모듈

다양한 Webhook 서비스(Slack, GitHub, Stripe 등)의 서로 다른 인증 방식(Header Key, Signature 등)을
유연하게 지원하기 위해 Strategy Pattern을 적용합니다.
"""

import abc
from typing import Optional

from fastapi import Request

from apps.shared.db.models.app import App


class WebhookAuthStrategy(abc.ABC):
    """Webhook 인증 전략 인터페이스"""

    @abc.abstractmethod
    def verify(self, request: Request, app: App) -> bool:
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

    def verify(self, request: Request, app: App) -> bool:
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


class AppWebhookAuthManager:
    """
    App별 적절한 인증 전략을 결정하고 실행하는 관리자
    """

    def __init__(self):
        # 기본 전략 등록
        self.default_strategy = DefaultWebhookStrategy()
        # 추후 App 설정(DB)에 따라 전략을 매핑하는 로직 추가 가능
        self.strategies = {
            "default": self.default_strategy,
            # "github": GitHubWebhookStrategy(),
            # "slack": SlackWebhookStrategy(),
        }

    def verify(self, request: Request, app: App) -> bool:
        """
        등록된 모든 인증 전략을 순차적으로 시도하여 검증합니다.
        하나라도 성공하면 True를 반환합니다.
        """
        # 등록된 모든 전략 순회
        for strategy in self.strategies.values():
            if strategy.verify(request, app):
                return True
        
        return False


# 싱글톤 인스턴스 (필요시 의존성 주입으로 사용)
webhook_auth_manager = AppWebhookAuthManager()
