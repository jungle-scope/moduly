import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 환경변수에서 개별 DB 설정 가져오기
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin123")
DB_NAME = os.getenv("DB_NAME", "moduly")

# DATABASE_URL 구성
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# SQLAlchemy 엔진 생성
engine = create_engine(
    DATABASE_URL, echo=False
)  # echo=True: SQL 쿼리 로그 출력, 디버깅 필요시 활성화

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
