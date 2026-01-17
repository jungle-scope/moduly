"""
Sandbox API - Execute Endpoint
"""
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.sandbox.core.scheduler import SandboxScheduler
from apps.sandbox.models.job import Priority


router = APIRouter()


class ExecuteRequest(BaseModel):
    """코드 실행 요청"""
    code: str = Field(..., description="실행할 Python 코드 (def main(inputs): ... 형태)")
    inputs: Dict[str, Any] = Field(default_factory=dict, description="입력 데이터")
    timeout: int = Field(default=10, ge=1, le=60, description="타임아웃 (초)")
    priority: str = Field(default="normal", description="우선순위 (high, normal, low)")
    enable_network: bool = Field(default=False, description="네트워크 허용 여부")
    tenant_id: Optional[str] = Field(default=None, description="테넌트 ID, 지금은 user_id (공정 스케줄링용)")


class ExecuteResponse(BaseModel):
    """코드 실행 응답"""
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    error_type: Optional[str] = None
    execution_time_ms: float = 0.0
    memory_used_mb: float = 0.0


class MetricsResponse(BaseModel):
    """스케줄러 메트릭"""
    queue_size: int
    queue_high: int
    queue_normal: int
    queue_low: int
    running_count: int
    total_submitted: int
    total_completed: int
    total_failed: int
    total_aged: int
    current_workers: int
    min_workers: int
    max_workers: int
    ema_rps: float
    active_tenants: int


@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(request: ExecuteRequest):
    """
    Python 코드를 안전한 샌드박스에서 실행합니다.
    
    코드는 `def main(inputs):` 형태로 작성해야 하며,
    반환값은 JSON 직렬화 가능한 딕셔너리여야 합니다.
    
    Example:
    ```python
    def main(inputs):
        x = inputs.get("x", 0)
        return {"result": x * 2}
    ```
    """
    scheduler = SandboxScheduler.get_instance()
    
    # 우선순위 파싱
    priority_map = {
        "high": Priority.HIGH,
        "normal": Priority.NORMAL,
        "low": Priority.LOW,
    }
    priority = priority_map.get(request.priority.lower(), Priority.NORMAL)
    
    try:
        result = await scheduler.submit(
            code=request.code,
            inputs=request.inputs,
            timeout=request.timeout,
            priority=priority,
            enable_network=request.enable_network,
            tenant_id=request.tenant_id,
        )
        
        return ExecuteResponse(
            success=result.success,
            result=result.result,
            error=result.error,
            error_type=result.error_type,
            execution_time_ms=result.execution_time_ms,
            memory_used_mb=result.memory_used_mb,
        )
        
    except ValueError as e:
        # Backpressure: 서비스 과부하
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        # 스케줄러 미시작
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics():
    """스케줄러 메트릭을 반환합니다."""
    scheduler = SandboxScheduler.get_instance()
    metrics = scheduler.get_metrics()
    return MetricsResponse(**metrics)


@router.get("/health")
async def health_check():
    """헬스 체크"""
    scheduler = SandboxScheduler.get_instance()
    return {
        "status": "healthy",
        "queue_size": scheduler.queue_size,
        "running_count": scheduler.running_count,
    }
