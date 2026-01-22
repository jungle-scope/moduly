"""
분산 락 유틸리티

여러 Pod에서 동시에 같은 문서를 처리하는 것을 방지합니다.
"""

import logging
from typing import Optional
from contextlib import contextmanager

from apps.shared.pubsub import get_redis_client

logger = logging.getLogger(__name__)


class DistributedLock:
    """Redis 기반 분산 락"""

    def __init__(self, lock_key: str, ttl: int = 120):
        """
        Args:
            lock_key: 락 키 (예: "doc_processing:uuid")
            ttl: 락 만료 시간(초), 기본 2분
        """
        self.lock_key = lock_key
        self.ttl = ttl
        self.redis_client = get_redis_client()

    def acquire(self) -> bool:
        """
        락 획득 시도

        Returns:
            성공 시 True, 이미 락이 걸려있으면 False
        """
        result = self.redis_client.set(
            self.lock_key,
            "1",
            nx=True,  # Not eXists: 키가 없을 때만 설정
            ex=self.ttl,  # EXpire: TTL 설정
        )
        if result:
            pass
            # logger.info(f"[DistributedLock] 락 획득 성공: {self.lock_key}")
        else:
            logger.warning(f"[DistributedLock] 락 이미 존재: {self.lock_key}")
        return bool(result)

    def release(self) -> None:
        """락 해제"""
        deleted = self.redis_client.delete(self.lock_key)
        if deleted:
            pass
            # logger.info(f"[DistributedLock] 락 해제: {self.lock_key}")

    @contextmanager
    def lock(self):
        """
        컨텍스트 매니저로 사용

        Example:
            with DistributedLock("doc:123").lock():
                # 처리 로직
                process_document()
        """
        acquired = self.acquire()
        try:
            yield acquired
        finally:
            if acquired:
                self.release()
