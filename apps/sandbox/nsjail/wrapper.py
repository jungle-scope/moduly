"""
NSJail Wrapper - NSJail CLI를 Python에서 호출하기 위한 래퍼
"""
import json
import os
import subprocess
import tempfile
import time
from typing import Any, Dict, Optional
from uuid import UUID

from apps.sandbox.config import settings
from apps.sandbox.models.result import ExecutionResult


class NSJailWrapper:
    """
    NSJail CLI 래퍼
    
    subprocess를 사용하여 nsjail 프로세스를 생성하고 관리합니다.
    """
    
    def __init__(
        self,
        nsjail_path: str = None,
        config_path: str = None,
        python_path: str = None,
    ):
        self.nsjail_path = nsjail_path or settings.NSJAIL_PATH
        self.config_path = config_path or settings.NSJAIL_CONFIG_PATH
        self.python_path = python_path or settings.PYTHON_PATH
        self.temp_dir = settings.TEMP_DIR
        
        # 임시 디렉토리 생성
        os.makedirs(self.temp_dir, exist_ok=True)
    
    def execute(
        self,
        code: str,
        inputs: Dict[str, Any],
        timeout: int = 10,
        enable_network: bool = False,
        job_id: UUID = None,
    ) -> ExecutionResult:
        """
        Python 코드를 NSJail 샌드박스 내에서 실행
        
        Args:
            code: 실행할 Python 코드 (def main(inputs): ... 형태)
            inputs: 코드에 전달할 입력 딕셔너리
            timeout: 실행 타임아웃 (초)
            enable_network: 네트워크 허용 여부
            job_id: 작업 ID (로깅용)
        
        Returns:
            ExecutionResult: 실행 결과
        """
        start_time = time.time()
        
        # 1. 실행할 스크립트를 임시 파일로 저장
        script_content = self._create_wrapper_script(code, inputs)
        script_path = self._write_temp_script(script_content, job_id)
        
        try:
            # DEV_MODE: NSJail 없이 직접 Python 실행 (Windows 개발용)
            if settings.DEV_MODE:
                result = subprocess.run(
                    ["python3", script_path],  # PATH에서 python3 찾기
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
            else:
                # 2. NSJail 명령 구성
                cmd = self._build_command(script_path, timeout, enable_network)
                
                # 3. subprocess 실행
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout + 2,  # NSJail 자체 타임아웃 + 여유
                )
            
            execution_time = (time.time() - start_time) * 1000
            
            # 4. 결과 파싱
            return self._parse_result(result, execution_time, job_id)
            
        except subprocess.TimeoutExpired:
            execution_time = (time.time() - start_time) * 1000
            return ExecutionResult.timeout_error(timeout, job_id)
            
        except Exception as e:
            return ExecutionResult.sandbox_error(str(e), job_id)
            
        finally:
            # 5. 임시 파일 정리
            self._cleanup_temp_script(script_path)
    
    def _create_wrapper_script(self, user_code: str, inputs: Dict[str, Any]) -> str:
        """
        사용자 코드를 래핑하는 실행 스크립트 생성
        """
        inputs_json = json.dumps(inputs, ensure_ascii=False)
        
        return f'''
import json
import sys

# 사용자 코드
{user_code}

# 실행 로직
try:
    inputs = json.loads('{inputs_json}')
    result = main(inputs)
    
    if not isinstance(result, dict):
        raise TypeError("main() must return a dict")
    
    # JSON 직렬화 가능한지 확인
    json.dumps(result)
    
    # 결과 출력 (stdout)
    print(json.dumps({{"success": True, "result": result}}, ensure_ascii=False))
    
except Exception as e:
    print(json.dumps({{"success": False, "error": str(e)}}, ensure_ascii=False))
    sys.exit(1)
'''
    
    def _write_temp_script(self, content: str, job_id: UUID = None) -> str:
        """임시 스크립트 파일 생성"""
        filename = f"script_{job_id or 'tmp'}.py"
        filepath = os.path.join(self.temp_dir, filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return filepath
    
    def _cleanup_temp_script(self, filepath: str):
        """임시 스크립트 파일 삭제"""
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass
    
    def _build_command(
        self,
        script_path: str,
        timeout: int,
        enable_network: bool,
    ) -> list:
        """NSJail 실행 명령 구성"""
        cmd = [
            self.nsjail_path,
            "--config", self.config_path,
            "--time_limit", str(timeout),
        ]
        
        # 네트워크 설정 (config에서 clone_newnet: true로 기본 비활성화됨)
        # enable_network가 true이면 네트워크 격리 비활성화
        if enable_network:
            cmd.extend(["--disable_clone_newnet"])
        
        # 스크립트 바인드 마운트
        cmd.extend([
            "--bindmount_ro", f"{script_path}:/app/run.py",
        ])
        
        # exec_bin은 config 파일에서 정의됨 (/usr/local/bin/python3 /app/run.py)
        # 별도의 -- 인자 불필요
        
        return cmd
    
    def _parse_result(
        self,
        proc_result: subprocess.CompletedProcess,
        execution_time: float,
        job_id: UUID = None,
    ) -> ExecutionResult:
        """subprocess 결과를 ExecutionResult로 변환"""
        stdout = proc_result.stdout.strip()
        stderr = proc_result.stderr.strip()
        
        # NSJail 자체 에러 체크
        if proc_result.returncode != 0 and not stdout:
            return ExecutionResult(
                success=False,
                error=stderr or f"NSJail exited with code {proc_result.returncode}",
                error_type="sandbox",
                execution_time_ms=execution_time,
                stdout=stdout,
                stderr=stderr,
                job_id=job_id,
            )
        
        # stdout에서 JSON 결과 파싱
        try:
            result_data = json.loads(stdout)
            
            if result_data.get("success"):
                return ExecutionResult(
                    success=True,
                    result=result_data.get("result"),
                    execution_time_ms=execution_time,
                    stdout=stdout,
                    stderr=stderr,
                    job_id=job_id,
                )
            else:
                return ExecutionResult(
                    success=False,
                    error=result_data.get("error", "Unknown error"),
                    error_type="runtime",
                    execution_time_ms=execution_time,
                    stdout=stdout,
                    stderr=stderr,
                    job_id=job_id,
                )
                
        except json.JSONDecodeError:
            # stderr에 에러 정보가 있을 수 있음
            error_msg = f"Invalid JSON output: {stdout[:200]}"
            if stderr:
                error_msg += f" | stderr: {stderr[:200]}"
            return ExecutionResult(
                success=False,
                error=error_msg,
                error_type="runtime",
                execution_time_ms=execution_time,
                stdout=stdout,
                stderr=stderr,
                job_id=job_id,
            )
