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
    
    def _auto_convert(self, value):
        """문자열을 적절한 타입으로 자동 변환"""
        if not isinstance(value, str):
            return value
        v = value.strip()
        if not v:
            return value
        if v.lower() == 'true':
            return True
        if v.lower() == 'false':
            return False
        if v.lower() in ('none', 'null'):
            return None
        try:
            return int(v)
        except ValueError:
            pass
        try:
            return float(v)
        except ValueError:
            pass
        return value

    def _preprocess_inputs(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """모든 입력 값을 자동 변환"""
        if isinstance(inputs, dict):
            return {k: self._auto_convert(v) for k, v in inputs.items()}
        return inputs
    
    def _create_wrapper_script(self, user_code: str, inputs: Dict[str, Any]) -> str:
        """
        사용자 코드를 래핑하는 실행 스크립트 생성
        입력 값은 미리 타입 변환 후 repr()로 직접 삽입
        """
        # 타입 변환 (문자열 "34" → int 34 등)
        converted_inputs = self._preprocess_inputs(inputs)
        inputs_repr = repr(converted_inputs)
        
        return f'''
import json
import sys

# 사용자 코드
{user_code}

# 실행 로직
try:
    inputs = {inputs_repr}
    result = main(inputs)
    
    if not isinstance(result, dict):
        raise TypeError("main() must return a dict")
    
    json.dumps(result)
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
