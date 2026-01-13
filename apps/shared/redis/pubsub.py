"""
Redis Pub/Sub 유틸리티

실시간 스트리밍을 위한 Redis Pub/Sub 기능을 제공합니다.
- Workflow Engine: 이벤트 발행 (publish_event)
- Gateway: 이벤트 구독 및 SSE 스트리밍 (subscribe_events)
"""
import asyncio
import json
import os
from typing import Any, AsyncGenerator, Dict, Optional

import redis
import redis.asyncio as aioredis

# Redis URL (환경변수로 설정 가능)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def get_redis_client() -> redis.Redis:
    """동기 Redis 클라이언트 반환"""
    return redis.from_url(REDIS_URL, decode_responses=True)


def get_async_redis_client() -> aioredis.Redis:
    """비동기 Redis 클라이언트 반환"""
    return aioredis.from_url(REDIS_URL, decode_responses=True)


def publish_event(channel: str, event_type: str, data: Dict[str, Any]) -> int:
    """
    이벤트 발행 (Worker에서 사용)
    
    Args:
        channel: Redis 채널명 (예: "run:{run_id}")
        event_type: 이벤트 타입 (예: "node_start", "node_finish", "workflow_finish")
        data: 이벤트 데이터
    
    Returns:
        이벤트를 수신한 구독자 수
    """
    client = get_redis_client()
    message = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return client.publish(channel, message)


async def subscribe_events(
    channel: str,
    timeout: Optional[float] = 600.0  # 10분 타임아웃
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    이벤트 구독 (Gateway에서 SSE 스트리밍용)
    
    Args:
        channel: Redis 채널명 (예: "run:{run_id}")
        timeout: 타임아웃 (초)
    
    Yields:
        이벤트 딕셔너리 {"type": str, "data": dict}
    """
    client = get_async_redis_client()
    pubsub = client.pubsub()
    await pubsub.subscribe(channel)
    
    try:
        start_time = asyncio.get_event_loop().time()
        
        async for message in pubsub.listen():
            # 타임아웃 체크
            if timeout:
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > timeout:
                    yield {"type": "error", "data": {"error": "Timeout"}}
                    break
            
            # 메시지 처리
            if message["type"] == "message":
                event = json.loads(message["data"])
                yield event
                
                # workflow_finish 또는 error 이벤트면 종료
                if event["type"] in ("workflow_finish", "error"):
                    break
                    
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await client.close()


def get_channel_name(run_id: str) -> str:
    """실행 ID에 대한 채널명 생성"""
    return f"run:{run_id}"
