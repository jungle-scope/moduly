import logging
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

# 환경변수에서 개별 DB 설정 가져오기
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")
DB_NAME = os.getenv("DB_NAME", "moduly_local")

# DATABASE_URL 구성
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemy 엔진 생성
engine = create_engine(
    DATABASE_URL,
    echo=False,  # echo=True: SQL 쿼리 로그 출력, 디버깅 필요시 활성화
    pool_size=20,  # 기본 커넥션 수 (기본값: 5)
    max_overflow=30,  # 추가 허용 커넥션 (기본값: 10)
    pool_timeout=60,  # 커넥션 대기 시간(초)
    pool_pre_ping=True,  # 커넥션 유효성 체크
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# [FIX] Celery multiprocessing fork 이슈 해결:
# Worker가 fork될 때 부모의 connection pool을 버리고 새로 초기화
try:
    from celery.signals import worker_process_init

    @worker_process_init.connect
    def init_worker_db_pool(**kwargs):
        """
        Celery worker 프로세스가 fork된 후 호출됩니다.
        부모 프로세스의 connection pool 상태를 버리고 깨끗한 상태로 시작합니다.

        이것은 "더러운 부모 프로세스" 문제를 방지합니다:
        - Worker 1-4: 초기 fork 시 깨끗한 상태
        - Worker 5+: 부모가 이미 DB 작업을 수행한 후 fork → pool dispose로 초기화
        """
        logger.info("Celery worker forked - disposing DB connection pool")
        engine.dispose()

except ImportError:
    # Celery가 설치되지 않은 환경에서는 무시 (예: 테스트 환경)
    pass


# FastAPI 의존성 주입용 함수
def get_db():
    """
    데이터베이스 세션을 생성하고 요청이 끝나면 자동으로 닫습니다.
    FastAPI의 Depends()와 함께 사용됩니다.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
