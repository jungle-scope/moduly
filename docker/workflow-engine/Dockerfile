# --- 1단계: 빌더(Builder) 스테이지 ---
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Workflow Engine 설치
# pyproject.toml에 shared 의존성이 아직 없더라도, 
# 추후 확장을 위해 shared도 COPY 해두는 것이 일관성 유지에 좋습니다.
COPY apps/shared /build/apps/shared
# RUN pip install --no-cache-dir --prefix=/install ./apps/shared 
# (현재 workflow-engine은 shared 의존성이 pyproject.toml에 명시 안되어있을 수 있으나 
# 필요하다면 주석 해제. 에러 방지를 위해 우선 생략하되 코드는 남겨둠)

COPY apps/workflow-engine /build/apps/workflow-engine
RUN pip install --no-cache-dir --prefix=/install ./apps/workflow-engine

# --- 2단계: 실행(Final) 스테이지 ---
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY apps/workflow-engine /app/apps/workflow-engine
# COPY apps/shared /app/apps/shared

RUN useradd -m appuser
USER appuser

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "apps.workflow.main:app", "--host", "0.0.0.0", "--port", "8000"]
