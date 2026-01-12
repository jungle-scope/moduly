# --- 1단계: 빌더(Builder) 스테이지 ---
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Shared 패키지 설치
COPY apps/shared /build/apps/shared
RUN pip install --no-cache-dir --prefix=/install ./apps/shared

# Log System 설치
COPY apps/log-system /build/apps/log-system
RUN pip install --no-cache-dir --prefix=/install ./apps/log-system

# --- 2단계: 실행(Final) 스테이지 ---
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY apps/log-system /app/apps/log-system
COPY apps/shared /app/apps/shared

RUN useradd -m appuser
USER appuser

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "apps.log_system.main:app", "--host", "0.0.0.0", "--port", "8000"]
