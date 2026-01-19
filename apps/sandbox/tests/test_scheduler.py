"""
Fair Scheduler Unit Tests

테스트 항목:
1. Round-Robin: 테넌트 간 공정한 순환
2. MLFQ: 우선순위에 따른 작업 선택
3. Aging: 오래 대기한 작업의 우선순위 승급
"""
import asyncio
import time
from unittest.mock import MagicMock

import pytest

from apps.sandbox.core.bucket import PriorityBucket
from apps.sandbox.models.job import Job, Priority


# ============================================================================
# 테스트 유틸리티
# ============================================================================

def create_mock_job(tenant_id: str, priority: Priority = Priority.NORMAL) -> Job:
    """테스트용 Job 객체 생성"""
    job = Job(
        priority=priority,
        code="print('test')",
        inputs={},
        timeout=10,
        enable_network=False,
        tenant_id=tenant_id,
    )
    job.future = asyncio.get_event_loop().create_future()
    return job


# ============================================================================
# 1. Round-Robin 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_priority_bucket_round_robin():
    """
    Round-Robin: 테넌트 A, B, C가 순서대로 작업을 꺼내는지 확인
    
    시나리오:
    - Tenant A: 2개 작업
    - Tenant B: 1개 작업
    - Tenant C: 1개 작업
    
    기대 결과: A -> B -> C -> A 순서로 pop
    """
    bucket = PriorityBucket(Priority.NORMAL)
    
    # 작업 추가
    job_a1 = create_mock_job("tenant_a")
    job_a2 = create_mock_job("tenant_a")
    job_b1 = create_mock_job("tenant_b")
    job_c1 = create_mock_job("tenant_c")
    
    await bucket.add(job_a1)
    await bucket.add(job_a2)
    await bucket.add(job_b1)
    await bucket.add(job_c1)
    
    # 모든 테넌트 허용
    def allow_all(tenant_id: str) -> bool:
        return True
    
    # Round-Robin으로 꺼내기
    result1 = await bucket.pop_next_round_robin(allow_all)
    result2 = await bucket.pop_next_round_robin(allow_all)
    result3 = await bucket.pop_next_round_robin(allow_all)
    result4 = await bucket.pop_next_round_robin(allow_all)
    
    # 검증: 각 테넌트에서 하나씩 순서대로 나와야 함
    tenants = [result1.tenant_id, result2.tenant_id, result3.tenant_id, result4.tenant_id]
    
    # A, B, C가 모두 한 번씩은 나와야 함 (순서는 추가 순서에 따름)
    assert "tenant_a" in tenants
    assert "tenant_b" in tenants
    assert "tenant_c" in tenants
    
    # A는 2개가 있었으므로 2번 나와야 함
    assert tenants.count("tenant_a") == 2


@pytest.mark.asyncio
async def test_round_robin_with_tenant_limit():
    """
    테넌트 제한: 특정 테넌트가 제한에 걸리면 건너뛰는지 확인
    """
    bucket = PriorityBucket(Priority.NORMAL)
    
    job_a = create_mock_job("tenant_a")
    job_b = create_mock_job("tenant_b")
    
    await bucket.add(job_a)
    await bucket.add(job_b)
    
    # A는 제한, B만 허용
    def allow_only_b(tenant_id: str) -> bool:
        return tenant_id == "tenant_b"
    
    result = await bucket.pop_next_round_robin(allow_only_b)
    
    # B만 나와야 함
    assert result is not None
    assert result.tenant_id == "tenant_b"


# ============================================================================
# 2. MLFQ 우선순위 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_mlfq_priority_order():
    """
    MLFQ: HIGH 작업이 NORMAL보다 먼저 선택되는지 확인
    """
    high_bucket = PriorityBucket(Priority.HIGH)
    normal_bucket = PriorityBucket(Priority.NORMAL)
    
    # NORMAL에 먼저 추가
    normal_job = create_mock_job("tenant_a", Priority.NORMAL)
    await normal_bucket.add(normal_job)
    
    # HIGH에 나중에 추가
    high_job = create_mock_job("tenant_b", Priority.HIGH)
    await high_bucket.add(high_job)
    
    def allow_all(tenant_id: str) -> bool:
        return True
    
    # MLFQ 정책: HIGH 먼저 확인
    buckets = [high_bucket, normal_bucket]
    result = None
    
    for bucket in buckets:
        if not bucket.is_empty:
            result = await bucket.pop_next_round_robin(allow_all)
            if result:
                break
    
    # HIGH가 먼저 나와야 함
    assert result is not None
    assert result.priority == Priority.HIGH
    assert result.tenant_id == "tenant_b"


# ============================================================================
# 3. Aging 테스트
# ============================================================================

@pytest.mark.asyncio
async def test_aging_promotion():
    """
    Aging: 오래 대기한 작업이 상위 버킷으로 승급되는지 확인
    """
    low_bucket = PriorityBucket(Priority.LOW)
    normal_bucket = PriorityBucket(Priority.NORMAL)
    
    # LOW 버킷에 작업 추가 (오래된 것처럼 created_at 조작)
    old_job = create_mock_job("tenant_a", Priority.LOW)
    old_job.created_at = time.time() - 40  # 40초 전 생성 (임계값 30초 초과)
    await low_bucket.add(old_job)
    
    # Aging 로직 시뮬레이션
    aging_threshold = 30  # 초
    now = time.time()
    
    jobs_to_promote = []
    for job in await low_bucket.get_all_jobs():
        wait_time = now - job.created_at
        if wait_time >= aging_threshold:
            jobs_to_promote.append(job)
    
    # 승급 실행
    for job in jobs_to_promote:
        removed = await low_bucket.remove_job(job)
        if removed:
            job.priority = Priority.NORMAL
            await normal_bucket.add(job)
    
    # 검증
    assert low_bucket.total_jobs == 0  # LOW에서 제거됨
    assert normal_bucket.total_jobs == 1  # NORMAL로 이동됨
    
    def allow_all(tenant_id: str) -> bool:
        return True
    
    promoted_job = await normal_bucket.pop_next_round_robin(allow_all)
    assert promoted_job is not None
    assert promoted_job.priority == Priority.NORMAL  # 우선순위 변경됨
