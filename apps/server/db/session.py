import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 환경변수에서 DATABASE_URL 가져오기
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin@localhost:5432/moduly"
)

# SQLAlchemy 엔진 생성
engine = create_engine(DATABASE_URL, echo=True)  # echo=True: SQL 쿼리 로그 출력

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
