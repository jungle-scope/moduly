"""
공통 유틸리티 함수들
"""
import uuid
from datetime import datetime, timezone


def generate_uuid() -> str:
    """UUID 문자열 생성"""
    return str(uuid.uuid4())


def get_current_time() -> datetime:
    """현재 UTC 시간 반환"""
    return datetime.now(timezone.utc)
