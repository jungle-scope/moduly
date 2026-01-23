"""
Fair Scheduler - MLFQ + Round-Robin + EMA-Based Dynamic Worker Pool Manager

주요 기능:
1. Multi-Level Feedback Queue (MLFQ): 우선순위별 버킷 (HIGH/NORMAL/LOW)
2. Round-Robin: 테넌트 간 공정한 스케줄링 (Head-of-Line Blocking 해결)
3. Aging: 오래 대기한 작업 우선순위 자동 승급 (Starvation 방지)
4. EMA-Based Dynamic Scaling: 요청 수의 이동평균 기반 워커 수 자동 조절
5. Tenant Limit: 테넌트당 동시 실행 제한
6. SJF (Shortest Job First): 과거 실행 기록 기반 우선순위 자동 결정
"""
import asyncio
import logging
import math
import time
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from typing import Dict, Optional
from uuid import UUID

from apps.sandbox.config import settings
from apps.sandbox.core.bucket import PriorityBucket
from apps.sandbox.core.executor import execute_code
from apps.sandbox.core.history import ExecutionHistory
from apps.sandbox.models.job import Job, Priority
from apps.sandbox.models.result import ExecutionResult


logger = logging.getLogger(__name__)


class FairScheduler:
    """
    Fair Scheduler - MLFQ + Round-Robin + Aging
    
    주요 기능:
    1. MLFQ: HIGH → NORMAL → LOW 순서로 작업 선택
    2. Round-Robin: 각 버킷 내에서 테넌트 간 공정한 순환
    3. Aging: 오래 대기한 작업 자동 승급
    4. EMA-Based Scaling: 요청 수 기반 워커 수 조절
    5. Tenant Limit: 테넌트당 동시 실행 제한
    """
    
    _instance: Optional["FairScheduler"] = None
    
    def __init__(self):
        # MLFQ: 우선순위별 버킷
        self._buckets = {
            Priority.HIGH: PriorityBucket(Priority.HIGH),
            Priority.NORMAL: PriorityBucket(Priority.NORMAL),
            Priority.LOW: PriorityBucket(Priority.LOW),
        }
        
        # Worker Pool
        self._executor: Optional[ProcessPoolExecutor] = None
        self._current_workers = settings.MIN_WORKERS
        
        # 실행 중인 작업 추적
        self._running_count = 0
        self._tenant_running: Dict[str, int] = defaultdict(int)
        
        # 메트릭
        self._total_submitted = 0
        self._total_completed = 0
        self._total_failed = 0
        self._total_aged = 0  # Aging으로 승급된 작업 수
        
        # EMA 기반 스케일링 상태
        self._requests_this_interval = 0
        self._ema_rps = 0.0
        self._last_busy_time = time.time()
        self._last_scale_down_time = 0.0
        
        # 백그라운드 태스크
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._scaling_task: Optional[asyncio.Task] = None
        self._aging_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        
        # SJF: 실행 기록 기반 우선순위 결정
        self._execution_history = ExecutionHistory()
    
    @classmethod
    def get_instance(cls) -> "FairScheduler":
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
        
        # 백그라운드 태스크 시작
        self._worker_task = asyncio.create_task(self._worker_loop())
        self._scaling_task = asyncio.create_task(self._scaling_loop())
        self._aging_task = asyncio.create_task(self._aging_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        if settings.FORCE_FIFO:
            logger.info(f"Fair Scheduler started in [FIFO MODE] (Priority Ignored) with {self._current_workers}/{settings.MAX_WORKERS} workers")
        else:
            logger.info(f"Fair Scheduler started in [SJF MODE] (MLFQ + Round-Robin) with {self._current_workers}/{settings.MAX_WORKERS} workers")
    
    async def stop(self):
        """스케줄러 중지"""
        self._running = False
        
        # 1. 백그라운드 태스크 중지
        for task in [self._worker_task, self._scaling_task, self._aging_task, self._cleanup_task]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # 2. 대기 중인 모든 작업에 "서버 종료" 에러 반환
        pending_count = 0
        for bucket in self._buckets.values():
            for job in await bucket.get_all_jobs():
                if job.future and not job.future.done():
                    job.future.set_result(
                        ExecutionResult.sandbox_error("Server shutting down", job.job_id)
                    )
                    pending_count += 1
        
        if pending_count > 0:
            logger.warning(f"Graceful shutdown: {pending_count} pending jobs cancelled")
        
        # 3. 워커 풀 종료
        if self._executor:
            self._executor.shutdown(wait=True)
            self._executor = None
        
        logger.info("Fair Scheduler stopped")
    
    async def submit(
        self,
        code: str,
        inputs: dict,
        timeout: int = None,
        priority: Priority = None,  # None이면 자동 결정
        trigger_mode: str = None,
        enable_network: bool = False,
        tenant_id: str = None,
    ) -> ExecutionResult:
        """작업 제출 및 결과 대기"""
        if not self._running:
            raise RuntimeError("Scheduler not running")
        
        # Backpressure
        total_jobs = sum(b.total_jobs for b in self._buckets.values())
        if total_jobs >= settings.MAX_QUEUE_SIZE:
            raise ValueError("Service overloaded, please retry later")
        
        # EMA 계산용 카운터
        self._requests_this_interval += 1
        
        # 우선순위 결정 (SJF + 트리거 유형 기반 fallback)
        if priority is None:
            # 트리거 유형에 따른 fallback 우선순위
            fallback_map = {
                "manual": Priority.HIGH,    # 사용자가 테스트 실행 중 (대기 중)
                "app": Priority.HIGH,       # 웹 앱 호출 (사용자 대기)
                "api": Priority.NORMAL,     # API 호출 (일반)
                "webhook": Priority.LOW,    # Webhook (백그라운드)
                "schedule": Priority.LOW,   # 스케줄 트리거 (백그라운드)
            }
            fallback = fallback_map.get(trigger_mode, Priority.NORMAL)
            priority = self._execution_history.suggest_priority(code, fallback=fallback)
        
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
        
        # 해당 우선순위 버킷에 추가
        await self._buckets[priority].add(job)
        self._total_submitted += 1
        
        logger.debug(f"Job {job.job_id} submitted (priority={priority.name}, tenant={tenant_id})")
        
        try:
            result = await future
            return result
        except asyncio.CancelledError:
            return ExecutionResult.sandbox_error("Job cancelled", job.job_id)
    
    async def _worker_loop(self):
        """메인 워커 루프: MLFQ + Round-Robin으로 작업 선택 및 실행"""
        loop = asyncio.get_event_loop()
        
        while self._running:
            try:
                # 워커 가용성 체크 
                if self._running_count >= self._current_workers:
                    await asyncio.sleep(0.05)
                    continue
                
                # 워커가 있을 때만 작업 꺼내기
                job = await self._get_next_job()
                
                if job is None:
                    await asyncio.sleep(0.1)
                    continue
                
                # 실행
                self._running_count += 1
                self._last_busy_time = time.time()
                
                tenant_id = job.tenant_id or "__default__"
                self._tenant_running[tenant_id] += 1
                
                asyncio.create_task(self._execute_job(job, loop))
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                await asyncio.sleep(0.5)
    
    async def _get_next_job(self) -> Optional[Job]:
        """MLFQ + Round-Robin으로 다음 작업 선택 """
        # 테넌트 실행 제한 체크 콜백
        def is_tenant_allowed(tenant_id: str) -> bool:
            return self._tenant_running[tenant_id] < settings.MAX_PER_TENANT
        
        # 우선순위 순서대로 버킷 순회
        for priority in [Priority.HIGH, Priority.NORMAL, Priority.LOW]:
            bucket = self._buckets[priority]
            
            if bucket.is_empty:
                continue
            
            # 원자적 Round-Robin pop
            job = await bucket.pop_next_round_robin(is_tenant_allowed)
            if job:
                return job
        
        return None
    
    async def _execute_job(self, job: Job, loop: asyncio.AbstractEventLoop):
        """작업 실행 및 결과 반환"""
        tenant_id = job.tenant_id or "__default__"
        start_time = time.time()
        
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
            
            # SJF: 실행 시간 기록 (성공한 경우만)
            if result.success:
                execution_time = time.time() - start_time
                self._execution_history.record(job.code, execution_time)
            
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
            self._tenant_running[tenant_id] -= 1
    
    async def _scaling_loop(self):
        """EMA 기반 동적 워커 스케일링"""
        while self._running:
            try:
                await asyncio.sleep(settings.SCALING_INTERVAL)
                
                current_rps = self._requests_this_interval / settings.SCALING_INTERVAL
                self._requests_this_interval = 0
                
                alpha = settings.EMA_ALPHA
                self._ema_rps = (alpha * current_rps) + ((1 - alpha) * self._ema_rps)
                
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
                
                if required_workers > current:
                    self._current_workers = required_workers
                    logger.info(f"Scale UP: {current} → {required_workers} workers (EMA RPS={self._ema_rps:.2f})")
                
                elif required_workers < current:
                    time_since_last_scale_down = now - self._last_scale_down_time
                    if time_since_last_scale_down < settings.SCALE_DOWN_COOLDOWN:
                        continue
                    
                    total_jobs = sum(b.total_jobs for b in self._buckets.values())
                    idle_time = now - self._last_busy_time
                    
                    if total_jobs == 0 and self._running_count == 0 and idle_time >= settings.SCALE_DOWN_IDLE_TIME:
                        self._current_workers = required_workers
                        self._last_scale_down_time = now
                        logger.info(f"Scale DOWN: {current} → {required_workers} workers (EMA RPS={self._ema_rps:.2f}, idle={idle_time:.1f}s)")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scaling loop error: {e}")
    
    async def _aging_loop(self):
        """Aging: 오래 대기한 작업 우선순위 승급"""
        while self._running:
            try:
                await asyncio.sleep(settings.AGING_INTERVAL)
                
                now = time.time()
                
                # LOW → NORMAL 승급
                low_bucket = self._buckets[Priority.LOW]
                for job in await low_bucket.get_all_jobs():
                    wait_time = now - job.created_at
                    if wait_time >= settings.AGING_THRESHOLD_LOW:
                        if await low_bucket.remove_job(job):
                            job.priority = Priority.NORMAL
                            await self._buckets[Priority.NORMAL].add(job)
                            self._total_aged += 1
                            logger.debug(f"Job {job.job_id} aged: LOW → NORMAL (waited {wait_time:.1f}s)")
                
                # NORMAL → HIGH 승급
                normal_bucket = self._buckets[Priority.NORMAL]
                for job in await normal_bucket.get_all_jobs():
                    wait_time = now - job.created_at
                    if wait_time >= settings.AGING_THRESHOLD_NORMAL:
                        if await normal_bucket.remove_job(job):
                            job.priority = Priority.HIGH
                            await self._buckets[Priority.HIGH].add(job)
                            self._total_aged += 1
                            logger.debug(f"Job {job.job_id} aged: NORMAL → HIGH (waited {wait_time:.1f}s)")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Aging loop error: {e}")
    
    async def _cleanup_loop(self):
        """빈 테넌트 큐 정리"""
        while self._running:
            try:
                await asyncio.sleep(settings.QUEUE_CLEANUP_INTERVAL)
                
                for bucket in self._buckets.values():
                    await bucket.cleanup_idle_queues(settings.QUEUE_IDLE_TIMEOUT)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
    
    @property
    def queue_size(self) -> int:
        return sum(b.total_jobs for b in self._buckets.values())
    
    @property
    def running_count(self) -> int:
        return self._running_count
    
    def get_metrics(self) -> dict:
        return {
            "queue_size": self.queue_size,
            "queue_high": self._buckets[Priority.HIGH].total_jobs,
            "queue_normal": self._buckets[Priority.NORMAL].total_jobs,
            "queue_low": self._buckets[Priority.LOW].total_jobs,
            "running_count": self.running_count,
            "total_submitted": self._total_submitted,
            "total_completed": self._total_completed,
            "total_failed": self._total_failed,
            "total_aged": self._total_aged,
            "current_workers": self._current_workers,
            "min_workers": settings.MIN_WORKERS,
            "max_workers": settings.MAX_WORKERS,
            "ema_rps": round(self._ema_rps, 2),
            "active_tenants": sum(b.active_tenants for b in self._buckets.values()),
        }


# 기존 SandboxScheduler와의 호환성을 위한 별칭
SandboxScheduler = FairScheduler
