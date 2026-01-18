"""
Sandbox Executor - NSJail 프로세스 실행 담당
"""
import time
from typing import Any, Dict
from uuid import UUID

from apps.sandbox.config import settings
from apps.sandbox.models.result import ExecutionResult
from apps.sandbox.nsjail.wrapper import NSJailWrapper


class SandboxExecutor:
    """
    코드 실행기
    
    NSJailWrapper를 사용하여 코드를 실행하고 결과를 반환합니다.
    ProcessPoolExecutor의 워커에서 호출됩니다.
    """
    
    def __init__(self):
        self.wrapper = NSJailWrapper()
    
    def execute(
        self,
        code: str,
        inputs: Dict[str, Any],
        timeout: int = None,
        enable_network: bool = None,
        job_id: UUID = None,
    ) -> ExecutionResult:
        """
        코드 실행
        
        Args:
            code: 실행할 Python 코드
            inputs: 입력 데이터
            timeout: 타임아웃 (초)
            enable_network: 네트워크 허용 여부
            job_id: 작업 ID
        
        Returns:
            ExecutionResult: 실행 결과
        """
        timeout = timeout or settings.DEFAULT_TIMEOUT
        enable_network = enable_network if enable_network is not None else settings.ENABLE_NETWORK
        
        # 타임아웃 상한 체크
        if timeout > settings.MAX_TIMEOUT:
            timeout = settings.MAX_TIMEOUT
        
        return self.wrapper.execute(
            code=code,
            inputs=inputs,
            timeout=timeout,
            enable_network=enable_network,
            job_id=job_id,
        )


# 모듈 레벨 함수 (ProcessPoolExecutor에서 사용)
def execute_code(
    code: str,
    inputs: Dict[str, Any],
    timeout: int = None,
    enable_network: bool = None,
    job_id: UUID = None,
) -> ExecutionResult:
    """
    ProcessPoolExecutor에서 호출할 함수
    
    각 Worker 프로세스에서 독립적으로 실행됩니다.
    """
    executor = SandboxExecutor()
    return executor.execute(
        code=code,
        inputs=inputs,
        timeout=timeout,
        enable_network=enable_network,
        job_id=job_id,
    )
