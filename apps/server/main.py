from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.api import api_router
from db.base import Base
from db.session import engine

app = FastAPI(title="Moduly API")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 프론트엔드 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 앱 시작 시 테이블 자동 생성
@app.on_event("startup")
def on_startup():
    """
    앱 시작 시 데이터베이스 테이블을 자동으로 생성합니다. (Base를 상속한 모든 모델)
    팀원들이 각자 로컬에서 실행하면 동일한 테이블 구조가 생성됩니다.
    """
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Moduly API is running"}
