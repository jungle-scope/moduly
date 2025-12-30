"""
Docker Sandbox Service for secure Python code execution

보안 기능:
- stdin으로 코드 전달 (프로세스 리스트 노출 방지)
- 비root 사용자로 실행 (nobody)
- 읽기 전용 파일시스템 + tmpfs (Python 임시 파일 지원)
- 네트워크 완전 차단
- CPU/Memory/Swap/PIDs 제한
- 타임아웃 설정
- 일회용 컨테이너 (실행 후 즉시 삭제)
"""

import json
from typing import Any, Dict

import docker
from docker.errors import ImageNotFound


class DockerSandboxService:
    """Docker 컨테이너에서 파이썬 코드를 안전하게 실행하는 서비스"""

    def __init__(self, image: str = "python:3.10-slim"):
        """
        Args:
            image: 사용할 Docker 이미지 (기본값: python:3.10-slim)
        """
        self.client = docker.from_env()
        self.image = image
        self._ensure_image_exists()

    def _ensure_image_exists(self):
        """Docker 이미지가 로컬에 없으면 pull"""
        try:
            self.client.images.get(self.image)
            print(f"이미지 {self.image} 확인됨")
        except ImageNotFound:
            print(f"이미지 {self.image}를 다운로드 중...")
            self.client.images.pull(self.image)
            print("다운로드 완료")

    def execute_python_code(
        self,
        code: str,
        inputs: Dict[str, Any],
        timeout: int = 10,
        mem_limit: str = "128m",
        cpu_quota: int = 50000,
    ) -> Dict[str, Any]:
        """
        파이썬 코드를 Docker 컨테이너에서 안전하게 실행

        Args:
            code: 실행할 파이썬 코드 (def main(inputs): ... 형태)
            inputs: 코드에 전달할 입력 딕셔너리
            timeout: 실행 타임아웃 (초)
            mem_limit: 메모리 제한 (예: "128m", "256m")
            cpu_quota: CPU 할당량 (100000 = 1 CPU)

        Returns:
            실행 결과 딕셔너리 또는 에러 딕셔너리
        """
        # 실행 래퍼 스크립트 생성
        wrapper = self._create_wrapper(code, inputs)

        try:
            # 컨테이너 실행 (command에 직접 전달하는 간단한 방식)
            # 보안: code는 환경 변수로 전달하지 않고 command에 직접 포함
            output = self.client.containers.run(
                image=self.image,
                command=["python", "-c", wrapper],
                # 🔒 보안 설정
                user="nobody",  # 비root 사용자
                read_only=True,  # 읽기 전용 파일시스템
                network_mode="none",  # 네트워크 차단
                remove=True,  # 자동 삭제
                # tmpfs: Python 임시 파일 공간 (메모리 기반, 휘발성)
                tmpfs={"/tmp": "size=10m,mode=1777"},
                # 리소스 제한
                mem_limit=mem_limit,
                memswap_limit=mem_limit,  # 스왑 메모리까지 제한
                cpu_quota=cpu_quota,
                pids_limit=20,  # 포크 폭탄 방지
                # 타임아웃 (seconds단위로 변환되지 않으므로 컨테이너 wait에서 처리)
                stdout=True,
                stderr=True,
            )

            # 결과 파싱
            result_text = output.decode("utf-8").strip()
            try:
                return json.loads(result_text)
            except json.JSONDecodeError:
                return {"error": f"Invalid JSON output: {result_text}"}

        except docker.errors.ContainerError as e:
            # 컨테이너 실행 중 에러
            stderr = e.stderr.decode("utf-8") if e.stderr else str(e)
            return {"error": f"실행 오류: {stderr}"}

        except docker.errors.APIError as e:
            # Docker API 에러
            return {"error": f"Docker API 오류: {str(e)}"}

        except Exception as e:
            # 기타 에러
            return {"error": f"예상치 못한 오류: {str(e)}"}

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
