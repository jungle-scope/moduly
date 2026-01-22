# ===================================================
# Workflow Engine Celery Worker Dockerfile
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
COPY apps/workflow_engine /build/apps/workflow_engine

# [FIX] 의존성만 설치 (코드는 /app/에서 직접 사용, site-packages 중복 방지)
# 1. pyproject.toml 기반으로 전체 설치 (의존성 해결을 위해)
# 2. 설치 후 site-packages에서 workflow/services 코드 삭제 (코드 중복 방지)
RUN pip install --no-cache-dir --prefix=/install /build/apps/shared /build/apps/workflow_engine && \
    rm -rf /install/lib/python3.11/site-packages/workflow && \
    rm -rf /install/lib/python3.11/site-packages/services && \
    rm -rf /install/lib/python3.11/site-packages/utils && \
    rm -rf /install/lib/python3.11/site-packages/tests && \
    rm -rf /install/lib/python3.11/site-packages/moduly_workflow_engine*.dist-info


# --- 2단계: 실행(Final) 스테이지 ---
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# 실행 시 필요한 최소 라이브러리 설치
RUN apt-get update && apt-get install -y \
    libpq5 \
    postgresql-client \
    redis-tools \
    && rm -rf /var/lib/apt/lists/*

# 빌더 스테이지에서 설치된 패키지 복사
COPY --from=builder /install /usr/local

# 앱 코드 복사 (모노레포 구조 유지)
COPY apps/shared /app/apps/shared
COPY apps/workflow_engine /app/apps/workflow_engine

# Entrypoint 스크립트 복사
COPY docker/workflow_engine/docker-entrypoint.sh /docker-entrypoint.sh

# 보안: Root가 아닌 일반 유저로 실행
RUN useradd -m appuser && chown -R appuser:appuser /app

# Entrypoint 스크립트 실행 권한 설정
RUN chmod +x /docker-entrypoint.sh

USER appuser

# Entrypoint 스크립트 실행
ENTRYPOINT ["/docker-entrypoint.sh"]
