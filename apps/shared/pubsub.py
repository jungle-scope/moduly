"""
Redis Pub/Sub 유틸리티

워크플로우 실행 상태를 실시간으로 스트리밍하기 위한 Pub/Sub 헬퍼 함수들입니다.
Gateway와 Workflow-Engine 간 실시간 통신에 사용됩니다.
"""

import json
import os
from typing import Any, Dict, Generator, Optional

import redis
import redis.asyncio as aioredis  # [NEW] 비동기 Redis 클라이언트

# Redis 연결 설정 (개별 환경변수로 URL 동적 생성)
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")
REDIS_DB = os.getenv("REDIS_DB", "0")

# 비밀번호 유무에 따라 Redis URL 생성
if REDIS_PASSWORD:
    REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
else:
    REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

# Redis 클라이언트 (지연 초기화)
_redis_client: Optional[redis.Redis] = None
_async_redis_client: Optional[aioredis.Redis] = None  # [NEW] 비동기 클라이언트


def get_redis_client() -> redis.Redis:
    """Redis 클라이언트 싱글톤 반환 (동기)"""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL)
    return _redis_client


def get_async_redis_client() -> aioredis.Redis:
    """Redis 클라이언트 싱글톤 반환 (비동기)"""
    global _async_redis_client
    if _async_redis_client is None:
        _async_redis_client = aioredis.from_url(REDIS_URL)
    return _async_redis_client


def publish_workflow_event(
    workflow_run_id: str, event_type: str, data: Dict[str, Any]
) -> None:
    """
    워크플로우 이벤트 발행 (동기)

    Args:
        workflow_run_id: 워크플로우 실행 ID
        event_type: 이벤트 타입 (node_start, node_finish, workflow_finish, error 등)
        data: 이벤트 데이터
    """
    client = get_redis_client()
    channel = f"workflow:{workflow_run_id}"
    message = json.dumps(
        {
            "type": event_type,
            "data": data,
        }
    )
    client.publish(channel, message)


async def publish_workflow_event_async(
    workflow_run_id: str, event_type: str, data: Dict[str, Any]
) -> None:
    """
    워크플로우 이벤트 발행 (비동기)
    [PERF] 이벤트 루프 차단을 방지하기 위해 비동기 Redis 클라이언트 사용

    Args:
        workflow_run_id: 워크플로우 실행 ID
        event_type: 이벤트 타입
        data: 이벤트 데이터
    """
    client = get_async_redis_client()
    channel = f"workflow:{workflow_run_id}"
    message = json.dumps(
        {
            "type": event_type,
            "data": data,
        }
    )
    # await로 비동기 발행
    await client.publish(channel, message)


def subscribe_workflow_events(
    workflow_run_id: str,
) -> Generator[Dict[str, Any], None, None]:
    """
    워크플로우 이벤트 구독 (Generator)

    Args:
        workflow_run_id: 워크플로우 실행 ID

    Yields:
        이벤트 딕셔너리 {"type": str, "data": dict}
    """
    client = get_redis_client()
    pubsub = client.pubsub()
    channel = f"workflow:{workflow_run_id}"
    pubsub.subscribe(channel)

    try:
        for message in pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                yield event
                # 워크플로우 종료 시 구독 종료
                if event.get("type") in ("workflow_finish", "error"):
                    break
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()
