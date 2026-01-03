# --- 1단계: 빌더(Builder) 스테이지 ---
# 빌드에 필요한 도구들을 포함하지만, 최종 이미지에서는 버려집니다.
FROM python:3.11-slim AS builder

WORKDIR /build

# 컴파일에 필요한 도구 설치 (psycopg2 등 빌드 시 필요)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 종속성 설치 (캐싱 최적화)
# 루트 기준 경로를 사용합니다.
COPY apps/server/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# --- 2단계: 실행(Final) 스테이지 ---
# 실제 서버가 돌아가는 가벼운 이미지입니다.
FROM python:3.11-slim

WORKDIR /app/apps/server

# 파이썬 패스에 루트 추가 (나중에 공통 패키지 쓸 때를 대비)
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 실행 시 필요한 최소 라이브러리만 설치
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 1단계에서 설치된 패키지만 복사하여 용량 다이어트
COPY --from=builder /install /usr/local

# [중요] 앱 코드 복사 (모노레포 구조 유지)
# 루트에서 apps/server 폴더 전체를 컨테이너 내부의 동일한 경로로 복사합니다.
COPY apps/server /app/apps/server

# 보안: Root가 아닌 일반 유저로 실행
RUN useradd -m appuser
USER appuser

# 환경 변수 설정
# 파이썬이 apps.server 모듈을 찾을 수 있도록 루트(/app)를 경로에 추가
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 헬스 체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=3s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

EXPOSE 8000

# 실행 명령 (모듈 경로 형식으로 지정)
CMD ["uvicorn", "apps.server.main:app", "--host", "0.0.0.0", "--port", "8000"]