"""
Sandbox Service for secure Python code execution via Moduly Sandbox API

보안 기능:
- NSJail 기반 프로세스 격리 (Dify 의존성 제거)
- HTTP API를 통한 코드 실행
- 타임아웃 설정
- Priority Queue 기반 스케줄링

[변경 이력]
- v2.0: Dify Sandbox → Moduly Sandbox (NSJail 기반) 마이그레이션
"""

import json
import logging
import os
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)


class CodeExecutionError(Exception):
    """코드 실행 중 발생한 에러"""
    pass


class SandboxService:
    """
    Moduly Sandbox API를 통해 파이썬 코드를 안전하게 실행하는 서비스
    
    내부적으로 NSJail 기반 샌드박스 서비스를 호출합니다.
    """

    def __init__(
        self,
        sandbox_url: str = None,
    ):
        """
        Args:
            sandbox_url: Sandbox API URL (기본값: 환경변수 SANDBOX_URL)
        """
        self.sandbox_url = sandbox_url or os.getenv(
            "SANDBOX_URL", "http://localhost:8194"
        )

    def execute_python_code(
        self,
        code: str,
        inputs: Dict[str, Any],
        timeout: int = 10,
        mem_limit: str = "128m",  # 호환성 유지 (미사용)
        cpu_quota: int = 50000,   # 호환성 유지 (미사용)
        priority: str = "normal",
        enable_network: bool = False,
    ) -> Dict[str, Any]:
        """
        파이썬 코드를 Moduly Sandbox API에서 안전하게 실행

        Args:
            code: 실행할 파이썬 코드 (def main(inputs): ... 형태)
            inputs: 코드에 전달할 입력 딕셔너리
            timeout: 실행 타임아웃 (초)
            mem_limit: 메모리 제한 (미사용, 호환성 유지)
            cpu_quota: CPU 할당량 (미사용, 호환성 유지)
            priority: 우선순위 ("high", "normal", "low")
            enable_network: 네트워크 허용 여부

        Returns:
            실행 결과 딕셔너리 또는 에러 딕셔너리
        """
        # URL 구성 (Moduly Sandbox API)
        url = f"{self.sandbox_url}/v1/sandbox/execute"

        # 요청 데이터 (새로운 API 형식)
        request_data = {
            "code": code,
            "inputs": inputs,
            "timeout": timeout,
            "priority": priority,
            "enable_network": enable_network,
        }

        # 타임아웃 설정
        timeout_config = httpx.Timeout(
            connect=5.0,
            read=float(timeout) + 5.0,  # 실행 시간 + 여유
            write=5.0,
            pool=None,
        )

        try:
            # HTTP POST 요청
            with httpx.Client(timeout=timeout_config) as client:
                response = client.post(
                    url,
                    json=request_data,
                    headers={"Content-Type": "application/json"},
                )

                # 에러 체크: 서비스 과부하
                if response.status_code == 503:
                    return {"error": "Code execution service is overloaded, please retry later"}

                # 에러 체크: 기타 HTTP 에러
                if response.status_code != 200:
                    error_msg = f"Sandbox API error (status {response.status_code}): {response.text[:200]}"
                    return {"error": error_msg}

                # 응답 파싱
                try:
                    response_data = response.json()
                except Exception:
                    return {"error": "Failed to parse sandbox response"}

                # Moduly Sandbox 응답 형식 처리
                # 응답 형식: {"success": true/false, "result": {...}, "error": "..."}
                if response_data.get("success"):
                    return response_data.get("result", {})
                else:
                    error_msg = response_data.get("error", "Unknown error")
                    error_type = response_data.get("error_type", "unknown")
                    return {"error": f"[{error_type}] {error_msg}"}

        except httpx.TimeoutException:
            error_msg = f"실행 시간 초과 ({timeout}초)"
            return {"error": error_msg}

        except httpx.RequestError as e:
            error_msg = f"Sandbox API 연결 오류: {str(e)}"
            return {"error": error_msg}

        except Exception as e:
            error_msg = f"예상치 못한 오류: {str(e)}"
            import traceback
            traceback.print_exc()
            return {"error": error_msg}
