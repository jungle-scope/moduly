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
    
    # 동적 워커 스케일링 (EMA 기반)
    SCALING_INTERVAL: int = int(os.getenv("SANDBOX_SCALING_INTERVAL", "1"))  # EMA 계산 주기 (초)
    EMA_ALPHA: float = float(os.getenv("SANDBOX_EMA_ALPHA", "0.2"))  # EMA 가중치 (0~1, 높을수록 최근값 반영)
    TARGET_RPS_PER_WORKER: float = float(os.getenv("SANDBOX_TARGET_RPS_PER_WORKER", "2.0"))  # 워커당 목표 RPS
    SCALE_DOWN_COOLDOWN: int = int(os.getenv("SANDBOX_SCALE_DOWN_COOLDOWN", "30"))  # Scale Down 후 쿨다운 (초)
    SCALE_DOWN_IDLE_TIME: int = int(os.getenv("SANDBOX_SCALE_DOWN_IDLE_TIME", "30"))  # 유휴 시간 (Scale Down 기준)
    
    # Fair Scheduler 설정
    MAX_PER_TENANT: int = int(os.getenv("SANDBOX_MAX_PER_TENANT", "3"))  # 테넌트당 최대 동시 실행
    AGING_INTERVAL: int = int(os.getenv("SANDBOX_AGING_INTERVAL", "5"))  # Aging 체크 주기 (초)
    AGING_THRESHOLD_LOW: int = int(os.getenv("SANDBOX_AGING_THRESHOLD_LOW", "15"))  # LOW→NORMAL 승급 (초)
    AGING_THRESHOLD_NORMAL: int = int(os.getenv("SANDBOX_AGING_THRESHOLD_NORMAL", "30"))  # NORMAL→HIGH 승급 (초)
    QUEUE_CLEANUP_INTERVAL: int = int(os.getenv("SANDBOX_QUEUE_CLEANUP_INTERVAL", "300"))  # 빈 큐 정리 주기 (초)
    QUEUE_IDLE_TIMEOUT: int = int(os.getenv("SANDBOX_QUEUE_IDLE_TIMEOUT", "600"))  # 빈 큐 삭제 기준 (초)
    
    # NSJail 설정
    NSJAIL_PATH: str = os.getenv("SANDBOX_NSJAIL_PATH", "/usr/bin/nsjail")
    NSJAIL_CONFIG_PATH: str = os.getenv("SANDBOX_NSJAIL_CONFIG_PATH", "/app/nsjail/sandbox.cfg")
    PYTHON_PATH: str = os.getenv("SANDBOX_PYTHON_PATH", "/usr/local/bin/python3")
    
    # 네트워크 설정
    ENABLE_NETWORK: bool = os.getenv("SANDBOX_ENABLE_NETWORK", "false").lower() == "true"
    
    # 임시 파일 경로
    TEMP_DIR: str = os.getenv("SANDBOX_TEMP_DIR", "/tmp/sandbox")
    
    # FIFO 모드 강제 (A/B 테스트용 - 우선순위 무시하고 순서대로 처리)
    FORCE_FIFO: bool = os.getenv("SANDBOX_FORCE_FIFO", "false").lower() == "true"


settings = SandboxSettings()
