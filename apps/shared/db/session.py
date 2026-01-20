import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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

# [FIX] Celery multiprocessing fork 이슈 해결:
# Worker가 fork될 때 DB engine을 완전히 재생성하여 최신 환경변수 반영
try:
    import logging

    from celery.signals import worker_process_init

    logger = logging.getLogger(__name__)

    @worker_process_init.connect
    def init_worker_db_pool(**kwargs):
        """
        Celery worker 프로세스가 fork된 후 호출됩니다.
        DB engine과 connection pool을 완전히 재생성하여:
        1. 부모 프로세스의 오염된 connection pool 상태 제거
        2. 환경변수 변경 반영 (예: localhost → AWS RDS 마이그레이션)

        이것은 다음 문제를 해결합니다:
        - "더러운 부모 프로세스" 문제 (connection pool 오염)
        - DB 이전 후 일부 worker가 예전 DB에 연결되는 문제
        - 간헐적인 credential 조회 실패
        """
        global engine, SessionLocal

        logger.info("Celery worker forked - recreating DB engine with fresh config")

        # 1. 기존 engine의 connection pool dispose
        engine.dispose()

        # 2. 환경변수 다시 읽기 (DB 이전 등으로 변경되었을 경우)
        import os

        fresh_db_host = os.getenv("DB_HOST", "localhost")
        fresh_db_port = os.getenv("DB_PORT", "5432")
        fresh_db_user = os.getenv("DB_USER", "admin")
        fresh_db_password = os.getenv("DB_PASSWORD", "admin123")
        fresh_db_name = os.getenv("DB_NAME", "moduly_local")
        fresh_database_url = f"postgresql://{fresh_db_user}:{fresh_db_password}@{fresh_db_host}:{fresh_db_port}/{fresh_db_name}"

        logger.info(
            f"Worker DB config: host={fresh_db_host}, port={fresh_db_port}, db={fresh_db_name}"
        )

        # 3. 새 engine 생성
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(
            fresh_database_url,
            echo=False,
            pool_size=20,
            max_overflow=30,
            pool_timeout=60,
            pool_pre_ping=True,
        )

        # 4. SessionLocal 재생성
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        logger.info("Worker DB engine recreated successfully")

except ImportError:
    # Celery가 설치되지 않은 환경에서는 무시 (예: 테스트 환경)
    pass

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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
