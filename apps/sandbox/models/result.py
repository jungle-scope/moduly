"""
Sandbox Service - Execution Result Models
"""
from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from uuid import UUID


@dataclass
class ExecutionResult:
    """코드 실행 결과"""
    
    # 성공 여부
    success: bool
    
    # 결과 데이터 (main 함수 반환값)
    result: Optional[Dict[str, Any]] = None
    
    # 에러 정보
    error: Optional[str] = None
    error_type: Optional[str] = None  # "timeout", "memory", "syntax", "runtime", "sandbox"
    
    # 실행 메트릭
    execution_time_ms: float = 0.0
    memory_used_mb: float = 0.0
    
    # stdout/stderr (디버깅용)
    stdout: str = ""
    stderr: str = ""
    
    # 메타데이터
    job_id: Optional[UUID] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """API 응답용 딕셔너리 변환"""
        return {
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "error_type": self.error_type,
            "execution_time_ms": self.execution_time_ms,
            "memory_used_mb": self.memory_used_mb,
        }
    
    @classmethod
    def timeout_error(cls, timeout: int, job_id: UUID = None) -> "ExecutionResult":
        """타임아웃 에러 결과 생성"""
        return cls(
            success=False,
            error=f"Code execution exceeded {timeout} seconds",
            error_type="timeout",
            execution_time_ms=timeout * 1000,
            job_id=job_id,
        )
    
    @classmethod
    def sandbox_error(cls, message: str, job_id: UUID = None) -> "ExecutionResult":
        """샌드박스 에러 결과 생성"""
        return cls(
            success=False,
            error=message,
            error_type="sandbox",
            job_id=job_id,
        )
