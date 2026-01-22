"""
Sandbox Service - Job and Priority Models
"""
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any, Dict, Optional
from uuid import UUID, uuid4
import asyncio
import time


class Priority(IntEnum):
    """작업 우선순위"""
    HIGH = 0      # 실시간 사용자 요청 (워크플로우 테스트 등)
    NORMAL = 1    # 일반 워크플로우 실행
    LOW = 2       # 배치 작업, 백그라운드 태스크


@dataclass(order=True)
class Job:
    """
    실행할 코드 작업 정의
    
    Priority Queue에서 정렬 가능하도록 order=True 설정
    priority 필드만 비교에 사용 (compare=False로 나머지 제외)
    """
    priority: int
    created_at: float = field(default_factory=time.time, compare=False)
    
    # 작업 식별
    job_id: UUID = field(default_factory=uuid4, compare=False)
    
    # 실행할 코드
    code: str = field(default="", compare=False)
    inputs: Dict[str, Any] = field(default_factory=dict, compare=False)
    
    # 실행 옵션
    timeout: int = field(default=10, compare=False)
    enable_network: bool = field(default=False, compare=False)
    
    # 결과 반환용
    future: Optional[asyncio.Future] = field(default=None, compare=False)
    
    # 메타데이터
    tenant_id: Optional[str] = field(default=None, compare=False)
    
    def __post_init__(self):
        """기본값 처리"""
        if self.created_at is None:
            self.created_at = time.time()
