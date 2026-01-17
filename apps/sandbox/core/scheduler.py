"""
Sandbox Scheduler - Priority Queue + EMA-Based Dynamic Worker Pool Manager
"""
import asyncio
import heapq
import logging
import math
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
    3. EMA-Based Dynamic Scaling: 요청 수의 이동평균 기반 워커 수 자동 조절
    4. Backpressure: 과부하 시 요청 거부
    5. Metrics: 실행 통계 수집
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
        
        # EMA 기반 스케일링 상태
        self._requests_this_interval = 0  # 현재 인터벌 동안의 요청 수
        self._ema_rps = 0.0  # 지수 이동 평균 RPS
        self._last_busy_time = time.time()
        self._last_scale_down_time = 0.0  # Scale Down 쿨다운용
        self._scaling_task: Optional[asyncio.Task] = None
        
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
        self._executor = ProcessPoolExecutor(max_workers=settings.MAX_WORKERS)
        self._worker_task = asyncio.create_task(self._worker_loop())
        self._scaling_task = asyncio.create_task(self._scaling_loop())
        logger.info(f"Sandbox Scheduler started with {self._current_workers}/{settings.MAX_WORKERS} workers (EMA-based scaling)")
    
    async def stop(self):
        """스케줄러 중지"""
        self._running = False
        
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        
        if self._scaling_task:
            self._scaling_task.cancel()
            try:
                await self._scaling_task
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
        
        # EMA 계산용 요청 카운터 증가
        self._requests_this_interval += 1
        
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
                    await asyncio.sleep(0.1)
                    continue
                
                # 워커 제한 체크
                if self._running_count >= self._current_workers:
                    async with self._queue_lock:
                        heapq.heappush(self._queue, job)
                    await asyncio.sleep(0.05)
                    continue
                
                # 비동기로 실행
                self._running_count += 1
                self._last_busy_time = time.time()
                
                if job.tenant_id:
                    self._tenant_running[job.tenant_id] = \
                        self._tenant_running.get(job.tenant_id, 0) + 1
                
                asyncio.create_task(self._execute_job(job, loop))
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(0.5)
    
    async def _scaling_loop(self):
        """
        EMA 기반 동적 워커 스케일링 루프
        
        매 인터벌마다:
        1. 현재 인터벌의 RPS 계산
        2. EMA 업데이트
        3. 필요한 워커 수 계산 및 조정
        """
        while self._running:
            try:
                await asyncio.sleep(settings.SCALING_INTERVAL)
                
                # 1. 현재 인터벌의 RPS 계산
                current_rps = self._requests_this_interval / settings.SCALING_INTERVAL
                self._requests_this_interval = 0  # 카운터 리셋
                
                # 2. EMA 업데이트: EMA = alpha * current + (1 - alpha) * prev_EMA
                alpha = settings.EMA_ALPHA
                self._ema_rps = (alpha * current_rps) + ((1 - alpha) * self._ema_rps)
                
                # 3. 필요한 워커 수 계산
                target_rps = settings.TARGET_RPS_PER_WORKER
                required_workers = max(
                    settings.MIN_WORKERS,
                    min(
                        settings.MAX_WORKERS,
                        math.ceil(self._ema_rps / target_rps) if target_rps > 0 else settings.MIN_WORKERS
                    )
                )
                
                current = self._current_workers
                now = time.time()
                
                # 4. Scale Up (즉시 반응)
                if required_workers > current:
                    self._current_workers = required_workers
                    logger.info(f"Scale UP: {current} → {required_workers} workers (EMA RPS={self._ema_rps:.2f})")
                
                # 5. Scale Down (쿨다운 적용 + 유휴 상태 확인)
                elif required_workers < current:
                    # 쿨다운 체크
                    time_since_last_scale_down = now - self._last_scale_down_time
                    if time_since_last_scale_down < settings.SCALE_DOWN_COOLDOWN:
                        continue
                    
                    # 유휴 상태 체크 (대기열 없고 실행 중 없음)
                    idle_time = now - self._last_busy_time
                    if len(self._queue) == 0 and self._running_count == 0 and idle_time >= settings.SCALE_DOWN_IDLE_TIME:
                        self._current_workers = required_workers
                        self._last_scale_down_time = now
                        logger.info(f"Scale DOWN: {current} → {required_workers} workers (EMA RPS={self._ema_rps:.2f}, idle={idle_time:.1f}s)")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scaling loop error: {e}")
    
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
                    heapq.heappush(self._queue, job)
                    return None
            
            return job
    
    async def _execute_job(self, job: Job, loop: asyncio.AbstractEventLoop):
        """작업 실행 및 결과 반환"""
        try:
            result = await loop.run_in_executor(
                self._executor,
                execute_code,
                job.code,
                job.inputs,
                job.timeout,
                job.enable_network,
                job.job_id,
            )
            
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
            "min_workers": settings.MIN_WORKERS,
            "max_workers": settings.MAX_WORKERS,
            "ema_rps": round(self._ema_rps, 2),
        }
