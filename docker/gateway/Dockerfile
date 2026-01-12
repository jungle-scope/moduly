# --- 1단계: 빌더(Builder) 스테이지 ---
FROM python:3.11-slim AS builder

WORKDIR /build

# 컴파일에 필요한 도구 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 종속성 설치 (캐싱 최적화)
# Shared 패키지 먼저 설치
COPY apps/shared /build/apps/shared
RUN pip install --no-cache-dir --prefix=/install ./apps/shared

# Gateway 패키지 의존성 설치
COPY apps/gateway/pyproject.toml /build/apps/gateway/
RUN pip install --no-cache-dir --prefix=/install -r /build/apps/gateway/pyproject.toml || true
# pyproject.toml 만으로는 requirements 추출이 어려울 수 있으므로, 
# 직접 . (current dir) 설치를 통해 의존성을 해결하거나,
# 만약 requirements.txt가 없다면 pip install . 사용.
# 여기서는 2단계에서 설치하므로, 빌더에서는 psycopg2 등 컴파일 필요한 것들 위주로 처리하면 좋지만,
# 편의상 최종 이미지에서 설치하도록 구성하거나, 여기서 wheel을 빌드하는 방식도 있음.
# 현재 구조에서는 간단하게 Runtime에서 바로 pip install . 하는게 나을 수 있음.
# 하지만 최적화를 위해 builder 패턴 유지.

# Gateway 설치 (의존성 포함)
COPY apps/gateway /build/apps/gateway
RUN pip install --no-cache-dir --prefix=/install ./apps/gateway

# --- 2단계: 실행(Final) 스테이지 ---
FROM python:3.11-slim

WORKDIR /app/apps/gateway

# 실행 시 필요한 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 빌드된 패키지 복사
COPY --from=builder /install /usr/local

# 소스 코드 복사 (디버깅 등의 이유로 필요할 수 있음. 설치된 패키지는 /usr/local에 있음)
# editable install이 아니므로 굳이 필요 없지만, 
# 로그 설정파일이나 정적 파일 등이 패키지 데이터로 포함되지 않았다면 필요할 수 있음.
# 여기서는 안전하게 복사.
COPY apps/gateway /app/apps/gateway
COPY apps/shared /app/apps/shared

# 보안: Root가 아닌 일반 유저로 실행
RUN useradd -m appuser
USER appuser

ENV PYTHONPATH=/app:/app/apps/gateway
ENV PYTHONUNBUFFERED=1

# 헬스 체크
HEALTHCHECK --interval=60s --timeout=10s --start-period=3s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
