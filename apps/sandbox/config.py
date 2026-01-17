"""
Sandbox Service Configuration
"""
import os


class SandboxSettings:
    """샌드박스 서비스 설정 (환경변수 기반)"""
    
    # Worker Pool 설정
    MIN_WORKERS: int = int(os.getenv("SANDBOX_MIN_WORKERS", "2"))
    MAX_WORKERS: int = int(os.getenv("SANDBOX_MAX_WORKERS", "8"))
    WORKER_IDLE_TIMEOUT: int = int(os.getenv("SANDBOX_WORKER_IDLE_TIMEOUT", "30"))
    
    # 실행 제한
    DEFAULT_TIMEOUT: int = int(os.getenv("SANDBOX_DEFAULT_TIMEOUT", "10"))
    MAX_TIMEOUT: int = int(os.getenv("SANDBOX_MAX_TIMEOUT", "60"))
    MAX_MEMORY_MB: int = int(os.getenv("SANDBOX_MAX_MEMORY_MB", "128"))
    MAX_OUTPUT_SIZE: int = int(os.getenv("SANDBOX_MAX_OUTPUT_SIZE", str(1024 * 1024)))
    
    # Queue 설정
    MAX_QUEUE_SIZE: int = int(os.getenv("SANDBOX_MAX_QUEUE_SIZE", "100"))
    
    # 동적 워커 스케일링
    SCALING_INTERVAL: int = int(os.getenv("SANDBOX_SCALING_INTERVAL", "5"))  # 스케일링 체크 주기 (초)
    SCALE_UP_THRESHOLD: float = float(os.getenv("SANDBOX_SCALE_UP_THRESHOLD", "0.8"))  # 큐/워커 비율이 이 이상이면 Scale Up
    SCALE_DOWN_IDLE_TIME: int = int(os.getenv("SANDBOX_SCALE_DOWN_IDLE_TIME", "30"))  # 이 시간(초) 동안 유휴 상태면 Scale Down
    
    # NSJail 설정
    NSJAIL_PATH: str = os.getenv("SANDBOX_NSJAIL_PATH", "/usr/bin/nsjail")
    NSJAIL_CONFIG_PATH: str = os.getenv("SANDBOX_NSJAIL_CONFIG_PATH", "/app/nsjail/sandbox.cfg")
    PYTHON_PATH: str = os.getenv("SANDBOX_PYTHON_PATH", "/usr/local/bin/python3")
    
    # 네트워크 설정
    ENABLE_NETWORK: bool = os.getenv("SANDBOX_ENABLE_NETWORK", "false").lower() == "true"
    
    # 임시 파일 경로
    TEMP_DIR: str = os.getenv("SANDBOX_TEMP_DIR", "/tmp/sandbox")
    
    # 개발 모드 (NSJail 없이 실행)
    DEV_MODE: bool = os.getenv("SANDBOX_DEV_MODE", "false").lower() == "true"


settings = SandboxSettings()
