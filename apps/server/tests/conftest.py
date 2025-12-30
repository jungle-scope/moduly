import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Generator

import pytest
from fastapi.testclient import TestClient
from pgvector.sqlalchemy import Vector
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.deps import get_db
from auth.dependencies import get_current_user
from db.base import Base
from db.models.user import User
from main import app


# --- SQLite Compatibility Fixes ---
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    """SQLite에서는 JSONB를 JSON으로 처리"""
    return "JSON"


@compiles(Vector, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    """SQLite에서는 Vector를 지원하지 않으므로 무시 (일반 텍스트 등으로 처리되거나 컬럼 생성 시 생략)"""
    # SQLite has no vector type, so we map it to NullType or simple BLOB/TEXT for table creation to succeed.
    # But simply returning a known type string works best.
    return "TEXT"


@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    """SQLite에서는 UUID를 VARCHAR로 처리"""
    return "VARCHAR(36)"


# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Test User ID
TEST_USER_ID = uuid.uuid4()


@pytest.fixture(scope="module")
def db_session() -> Generator:
    # Create tables
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def test_user_id():
    return TEST_USER_ID


@pytest.fixture(scope="module")
def client(db_session) -> Generator:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        # Mock User with UUID
        return User(id=TEST_USER_ID, email="test@example.com", name="Test User")

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(app) as c:
        yield c
