# ===================================================
# Log System Celery Worker Dockerfile
# ===================================================

# --- 1단계: 빌더(Builder) 스테이지 ---
FROM python:3.11-slim AS builder

WORKDIR /build

# 컴파일에 필요한 도구 설치
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 공통 패키지 복사 및 설치
COPY apps/shared /build/apps/shared
COPY apps/log_system /build/apps/log_system

# pyproject.toml 기반으로 설치
RUN pip install --no-cache-dir --prefix=/install \
    /build/apps/shared \
    /build/apps/log_system


# --- 2단계: 실행(Final) 스테이지 ---
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 실행 시 필요한 최소 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# 빌더 스테이지에서 설치된 패키지 복사
COPY --from=builder /install /usr/local

# 앱 코드 복사 (모노레포 구조 유지)
COPY apps/shared /app/apps/shared
COPY apps/log_system /app/apps/log_system

# 보안: Root가 아닌 일반 유저로 실행
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Celery Worker 실행
CMD ["celery", "-A", "apps.log_system.main", "worker", "-Q", "log", "-l", "info", "-c", "4"]
