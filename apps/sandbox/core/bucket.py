"""
Priority Bucket - 테넌트별 Round-Robin 큐 관리

Fair Scheduler의 MLFQ에서 각 우선순위 레벨(HIGH/NORMAL/LOW)을 담당합니다.
"""
import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Dict, List, Optional

from apps.sandbox.models.job import Job, Priority


logger = logging.getLogger(__name__)


class PriorityBucket:
    """
    우선순위 버킷: 테넌트별 큐를 관리하고 Round-Robin 선택을 지원
    
    특징:
    - 테넌트별로 독립적인 deque 관리
    - Round-Robin으로 테넌트 간 공정한 순환
    - 빈 큐 자동 정리 지원
    """
    
    def __init__(self, priority: Priority):
        self.priority = priority
        self._queues: Dict[str, deque[Job]] = defaultdict(deque)  # tenant_id -> deque of jobs
        self._tenant_order: List[str] = []  # Round-Robin 순서
        self._current_index = 0
        self._last_activity: Dict[str, float] = {}  # tenant_id -> last activity time
        self._lock = asyncio.Lock()
    
    async def add(self, job: Job):
        """작업 추가"""
        async with self._lock:
            tenant_id = job.tenant_id or "__default__"
            
            # 새 테넌트면 순서에 추가
            if tenant_id not in self._queues or len(self._queues[tenant_id]) == 0:
                if tenant_id not in self._tenant_order:
                    self._tenant_order.append(tenant_id)
            
            self._queues[tenant_id].append(job)
            self._last_activity[tenant_id] = time.time()
    
    async def pop(self, tenant_id: str) -> Optional[Job]:
        """특정 테넌트의 작업 가져오기"""
        async with self._lock:
            if tenant_id in self._queues and self._queues[tenant_id]:
                job = self._queues[tenant_id].popleft()
                self._last_activity[tenant_id] = time.time()
                
                # 큐가 비었으면 순서에서 제거
                if not self._queues[tenant_id]:
                    if tenant_id in self._tenant_order:
                        self._tenant_order.remove(tenant_id)
                        if self._current_index >= len(self._tenant_order):
                            self._current_index = 0
                
                return job
            return None
    
    async def next_tenant(self) -> Optional[str]:
        """Round-Robin으로 다음 테넌트 선택"""
        async with self._lock:
            if not self._tenant_order:
                return None
            
            tenant = self._tenant_order[self._current_index]
            self._current_index = (self._current_index + 1) % len(self._tenant_order)
            return tenant
    
    async def get_all_jobs(self) -> List[Job]:
        """모든 작업 목록 반환 (Aging용)"""
        async with self._lock:
            jobs = []
            for queue in self._queues.values():
                jobs.extend(queue)
            return jobs
    
    async def remove_job(self, job: Job) -> bool:
        """특정 작업 제거 (Aging 승급용)"""
        async with self._lock:
            tenant_id = job.tenant_id or "__default__"
            if tenant_id in self._queues:
                try:
                    self._queues[tenant_id].remove(job)
                    
                    # 큐가 비었으면 순서에서 제거
                    if not self._queues[tenant_id]:
                        if tenant_id in self._tenant_order:
                            self._tenant_order.remove(tenant_id)
                            if self._current_index >= len(self._tenant_order):
                                self._current_index = 0
                    
                    return True
                except ValueError:
                    return False
            return False
    
    async def cleanup_idle_queues(self, idle_timeout: float):
        """오래된 빈 큐 정리"""
        async with self._lock:
            now = time.time()
            to_remove = []
            
            for tenant_id, queue in self._queues.items():
                if len(queue) == 0:
                    last = self._last_activity.get(tenant_id, 0)
                    if now - last > idle_timeout:
                        to_remove.append(tenant_id)
            
            for tenant_id in to_remove:
                del self._queues[tenant_id]
                self._last_activity.pop(tenant_id, None)
                if tenant_id in self._tenant_order:
                    self._tenant_order.remove(tenant_id)
            
            if to_remove:
                logger.debug(f"Cleaned up {len(to_remove)} idle queues from {self.priority.name} bucket")
    
    @property
    def is_empty(self) -> bool:
        return len(self._tenant_order) == 0
    
    @property
    def total_jobs(self) -> int:
        return sum(len(q) for q in self._queues.values())
    
    @property
    def active_tenants(self) -> int:
        return len(self._tenant_order)
