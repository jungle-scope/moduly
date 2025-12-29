from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.api import api_router
from db.base import Base
from db.session import engine

app = FastAPI(title="Moduly API", redirect_slashes=False)

# CORS 설정 (withCredentials 지원)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Frontend 개발 서버
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,  # ✅ 쿠키 전송 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(api_router, prefix="/api/v1")


# 앱 시작 시 테이블 자동 생성
@app.on_event("startup")
def on_startup():
    """
    앱 시작 시 데이터베이스 테이블을 자동으로 생성합니다.
    """
    # 모든 모델 클래스를 Import하여 메타데이터에 등록되게 함

    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


@app.get("/")
def root():
    return {"message": "Moduly API Server"}
