"""
Database Migration Script: Add 'embed' to DeploymentType Enum

이 스크립트는 PostgreSQL의 DeploymentType enum에 'embed' 값을 추가합니다.
기존 데이터를 유지하면서 DB 스키마만 업데이트합니다.

사용법:
    cd apps/server
    python update_db.py

주의사항:
    - .env 파일에 DATABASE_URL이 설정되어 있어야 합니다
    - 이미 'embed' 값이 존재하면 안전하게 스킵됩니다
    - 실행 후 FastAPI 서버를 재시작해야 합니다
"""

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# .env 로드
load_dotenv()

# 환경변수에서 DATABASE_URL 가져오기
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://admin:admin123@localhost:5432/moduly"
)

# SQLAlchemy 엔진 생성
engine = create_engine(DATABASE_URL, echo=False)


def add_enum_value():
    """DeploymentType enum에 'embed' 값을 추가합니다."""
    print("🔄 Adding 'embed' value to DeploymentType enum...")

    # ALTER TYPE은 트랜잭션 블록 내에서 실행 불가 -> AUTOCOMMIT 설정 필요
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        try:
            # 쿼리 실행
            conn.execute(text("ALTER TYPE deploymenttype ADD VALUE 'embed'"))
            print("✅ Successfully added 'embed' to DeploymentType enum!")
            print("\n다음 단계:")
            print("1. FastAPI 서버 재시작: uvicorn main:app --reload")
            print("2. 프론트엔드에서 임베딩 배포 테스트")

        except Exception as e:
            error_msg = str(e)
            # 이미 존재하는 경우
            if "already exists" in error_msg or "duplicate key" in error_msg:
                print("ℹ️  'embed' value already exists in the enum.")
                print("✅ No action needed - database is already up to date!")
            else:
                print(f"❌ Error executing query: {error_msg}")
                raise


if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add DeploymentType.EMBED")
    print("=" * 60)
    print()

    add_enum_value()

    print()
    print("=" * 60)
    print("Migration completed!")
    print("=" * 60)
