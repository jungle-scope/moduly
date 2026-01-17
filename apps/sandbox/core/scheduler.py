"""
Sandbox Scheduler - Priority Queue + Worker Pool Manager
"""
import asyncio
import heapq
import logging
import time
from concurrent.futures import ProcessPoolExecutor
from typing import Dict, Optional
from uuid import UUID

from apps.sandbox.config import settings
from apps.sandbox.core.executor import execute_code
from apps.sandbox.models.job import Job, Priority
from apps.sandbox.models.result import ExecutionResult


logger = logging.getLogger(__name__)


class SandboxScheduler:
    """
    샌드박스 스케줄러
    
    주요 기능:
    1. Priority Queue: 우선순위 기반 작업 관리
    2. Worker Pool: ProcessPoolExecutor로 동시 실행 관리
    3. Backpressure: 과부하 시 요청 거부
    4. Metrics: 실행 통계 수집
    """
    
    _instance: Optional["SandboxScheduler"] = None
    
    def __init__(self):
        # Priority Queue (heapq 사용)
        self._queue: list[Job] = []
        self._queue_lock = asyncio.Lock()
        
        # Worker Pool
        self._executor: Optional[ProcessPoolExecutor] = None
        self._current_workers = settings.MIN_WORKERS
        
        # 실행 중인 작업 추적
        self._running_jobs: Dict[UUID, asyncio.Task] = {}
        self._running_count = 0
        
        # Tenant별 실행 제한
        self._tenant_running: Dict[str, int] = {}
        self._max_per_tenant = 3
        
        # 메트릭
        self._total_submitted = 0
        self._total_completed = 0
        self._total_failed = 0
        
        # 상태
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
    
    @classmethod
    def get_instance(cls) -> "SandboxScheduler":
        """싱글톤 인스턴스 반환"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def start(self):
        """스케줄러 시작"""
        if self._running:
            return
        
        self._running = True
        self._executor = ProcessPoolExecutor(max_workers=self._current_workers)
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info(f"Sandbox Scheduler started with {self._current_workers} workers")
    
    async def stop(self):
        """스케줄러 중지"""
        self._running = False
        
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        
        if self._executor:
            self._executor.shutdown(wait=True)
            self._executor = None
        
        logger.info("Sandbox Scheduler stopped")
    
    async def submit(
        self,
        code: str,
        inputs: dict,
        timeout: int = None,
        priority: Priority = Priority.NORMAL,
        enable_network: bool = False,
        tenant_id: str = None,
    ) -> ExecutionResult:
        """
        작업 제출 및 결과 대기
        
        Args:
            code: 실행할 Python 코드
            inputs: 입력 데이터
            timeout: 타임아웃 (초)
            priority: 우선순위
            enable_network: 네트워크 허용 여부
            tenant_id: 테넌트 ID (공정 스케줄링용)
        
        Returns:
            ExecutionResult: 실행 결과
        
        Raises:
            RuntimeError: 스케줄러가 시작되지 않은 경우
            ValueError: 큐가 가득 찬 경우
        """
        if not self._running:
            raise RuntimeError("Scheduler not running")
        
        # Backpressure: 큐 사이즈 체크
        if len(self._queue) >= settings.MAX_QUEUE_SIZE:
            raise ValueError("Service overloaded, please retry later")
        
        # Job 생성
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        
        job = Job(
            priority=priority,
            code=code,
            inputs=inputs,
            timeout=timeout or settings.DEFAULT_TIMEOUT,
            enable_network=enable_network,
            future=future,
            tenant_id=tenant_id,
        )
        
        # 큐에 추가
        async with self._queue_lock:
            heapq.heappush(self._queue, job)
            self._total_submitted += 1
        
        logger.debug(f"Job {job.job_id} submitted (priority={priority})")
        
        # 결과 대기
        try:
            result = await future
            return result
        except asyncio.CancelledError:
            return ExecutionResult.sandbox_error("Job cancelled", job.job_id)
    
    async def _worker_loop(self):
        """
        메인 워커 루프
        
        큐에서 작업을 가져와 실행합니다.
        """
        loop = asyncio.get_event_loop()
        
        while self._running:
            try:
                job = await self._get_next_job()
                
                if job is None:
                    # 큐가 비었으면 잠시 대기
                    await asyncio.sleep(0.1)
                    continue
                
                # 워커 제한 체크
                if self._running_count >= self._current_workers:
                    # 워커가 모두 바쁘면 다시 큐에 넣고 대기
                    async with self._queue_lock:
                        heapq.heappush(self._queue, job)
                    await asyncio.sleep(0.05)
                    continue
                
                # 비동기로 실행
                self._running_count += 1
                if job.tenant_id:
                    self._tenant_running[job.tenant_id] = \
                        self._tenant_running.get(job.tenant_id, 0) + 1
                
                asyncio.create_task(self._execute_job(job, loop))
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(0.5)
    
    async def _get_next_job(self) -> Optional[Job]:
        """우선순위에 따라 다음 작업 가져오기"""
        async with self._queue_lock:
            if not self._queue:
                return None
            
            job = heapq.heappop(self._queue)
            
            # Tenant 제한 체크
            if job.tenant_id:
                current = self._tenant_running.get(job.tenant_id, 0)
                if current >= self._max_per_tenant:
                    # 다시 큐에 넣고 None 반환
                    heapq.heappush(self._queue, job)
                    return None
            
            return job
    
    async def _execute_job(self, job: Job, loop: asyncio.AbstractEventLoop):
        """작업 실행 및 결과 반환"""
        try:
            # ProcessPoolExecutor에서 실행
            result = await loop.run_in_executor(
                self._executor,
                execute_code,
                job.code,
                job.inputs,
                job.timeout,
                job.enable_network,
                job.job_id,
            )
            
            # 결과 전달
            if not job.future.done():
                job.future.set_result(result)
            
            if result.success:
                self._total_completed += 1
            else:
                self._total_failed += 1
            
            logger.debug(f"Job {job.job_id} completed (success={result.success})")
            
        except Exception as e:
            logger.error(f"Job {job.job_id} execution error: {e}")
            if not job.future.done():
                job.future.set_result(
                    ExecutionResult.sandbox_error(str(e), job.job_id)
                )
            self._total_failed += 1
            
        finally:
            self._running_count -= 1
            if job.tenant_id and job.tenant_id in self._tenant_running:
                self._tenant_running[job.tenant_id] -= 1
    
    @property
    def queue_size(self) -> int:
        """현재 큐 사이즈"""
        return len(self._queue)
    
    @property
    def running_count(self) -> int:
        """실행 중인 작업 수"""
        return self._running_count
    
    def get_metrics(self) -> dict:
        """메트릭 반환"""
        return {
            "queue_size": self.queue_size,
            "running_count": self.running_count,
            "total_submitted": self._total_submitted,
            "total_completed": self._total_completed,
            "total_failed": self._total_failed,
            "current_workers": self._current_workers,
        }
