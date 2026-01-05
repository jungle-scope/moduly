"""
Sandbox Service for secure Python code execution via Dify Sandbox API

보안 기능:
- Dify Sandbox 컨테이너에서 격리된 실행 환경
- HTTP API를 통한 코드 실행
- 타임아웃 설정
- 네트워크 프록시를 통한 외부 요청 제어
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


class DockerSandboxService:
    """Dify Sandbox API를 통해 파이썬 코드를 안전하게 실행하는 서비스"""

    def __init__(
        self,
        sandbox_url: str = None,
        api_key: str = None,
    ):
        """
        Args:
            sandbox_url: Dify Sandbox API URL (기본값: 환경변수 SANDBOX_URL)
            api_key: API 인증 키 (기본값: 환경변수 SANDBOX_API_KEY)
        """
        self.sandbox_url = sandbox_url or os.getenv(
            "SANDBOX_URL", "http://sandbox.local:8194"
        )
        self.api_key = api_key or os.getenv("SANDBOX_API_KEY", "Modulycallsandbox306")

    def execute_python_code(
        self,
        code: str,
        inputs: Dict[str, Any],
        timeout: int = 10,
        mem_limit: str = "128m",
        cpu_quota: int = 50000,
    ) -> Dict[str, Any]:
        """
        파이썬 코드를 Dify Sandbox API에서 안전하게 실행

        Args:
            code: 실행할 파이썬 코드 (def main(inputs): ... 형태)
            inputs: 코드에 전달할 입력 딕셔너리
            timeout: 실행 타임아웃 (초)
            mem_limit: 메모리 제한 (미사용, API 호환성 유지)
            cpu_quota: CPU 할당량 (미사용, API 호환성 유지)

        Returns:
            실행 결과 딕셔너리 또는 에러 딕셔너리
        """
        # 실행 래퍼 스크립트 생성
        wrapper = self._create_wrapper(code, inputs)

        # URL 구성
        url = f"{self.sandbox_url}/v1/sandbox/run"

        # 헤더 설정
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": self.api_key,
        }

        # 요청 데이터
        request_data = {
            "language": "python3",
            "code": wrapper,
            "preload": "",
            "enable_network": True,
        }

        # 타임아웃 설정
        timeout_config = httpx.Timeout(
            connect=5.0,
            read=float(timeout),
            write=5.0,
            pool=None,
        )

        try:
            # HTTP POST 요청
            with httpx.Client(timeout=timeout_config) as client:
                response = client.post(url, json=request_data, headers=headers)

                # 에러 체크: 서비스 불가
                if response.status_code == 503:
                    return {"error": "Code execution service is unavailable"}

                # 에러 체크: 기타 HTTP 에러
                if response.status_code != 200:
                    error_msg = f"Failed to execute code, status {response.status_code}: {response.text}"
                    return {"error": f"{error_msg}"}

                # 응답 파싱
                try:
                    response_data = response.json()
                except Exception:
                    return {"error": "Failed to parse sandbox response"}

                # Dify Sandbox 응답 형식 처리
                # 응답 형식: {"code": 0, "message": "...", "data": {"stdout": "...", "error": "..."}}
                response_code = response_data.get("code")
                if response_code != 0:
                    error_msg = response_data.get("message", "Unknown error")
                    return {"error": f"Sandbox error: {error_msg}"}

                # data 추출
                data = response_data.get("data", {})

                # 실행 중 에러 확인
                if data.get("error"):
                    return {"error": data["error"]}

                # stdout에서 JSON 결과 추출
                stdout = data.get("stdout", "")
                if not stdout:
                    return {"error": "No output from code execution"}

                # JSON 파싱
                try:
                    result = json.loads(stdout.strip())
                    return result
                except json.JSONDecodeError:
                    return {"error": f"Invalid JSON output: {stdout[:100]}..."}

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

    def _create_wrapper(self, user_code: str, inputs: Dict[str, Any]) -> str:
        """
        사용자 코드를 래핑하는 스크립트 생성

        Args:
            user_code: 사용자가 작성한 코드
            inputs: 입력 딕셔너리

        Returns:
            실행 가능한 완전한 파이썬 스크립트
        """
        # inputs를 Python 딕셔너리 리터럴 문자열로 변환 (repr 사용)
        inputs_repr = repr(inputs)

        wrapper = f"""
import json
import sys

# 사용자 코드
{user_code}

# 실행 로직
try:
    # Python 딕셔너리 직접 삽입
    inputs = {inputs_repr}
    result = main(inputs)
    
    # 리턴값 검증
    if not isinstance(result, dict):
        raise TypeError("main() must return a dict")
    
    # JSON 직렬화 가능한지 확인
    json.dumps(result)
    
    # 결과 출력
    print(json.dumps(result))

except Exception as e:
    # 에러를 JSON으로 출력
    print(json.dumps({{"error": str(e)}}))
    sys.exit(1)
"""
        return wrapper
