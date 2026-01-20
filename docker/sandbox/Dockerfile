# Moduly Sandbox Service
# NSJail 기반 Python 코드 실행 샌드박스

FROM python:3.10-slim

# =====================================
# 시스템 의존성 설치
# =====================================
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

RUN apt-get update && apt-get install -y --no-install-recommends \
    # 빌드 도구
    build-essential \
    git \
    # NSJail 빌드 의존성
    autoconf \
    bison \
    flex \
    gcc \
    g++ \
    make \
    pkg-config \
    libnl-route-3-dev \
    libprotobuf-dev \
    protobuf-compiler \
    libcap-dev \
    # 시간대 설정
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# =====================================
# NSJail 빌드 및 설치
# =====================================
WORKDIR /build

RUN git clone https://github.com/google/nsjail.git \
    && cd nsjail \
    && make \
    && cp nsjail /usr/bin/nsjail \
    && chmod +x /usr/bin/nsjail \
    && cd / \
    && rm -rf /build

# NSJail 동작 확인
RUN nsjail --version || true

# =====================================
# Python 애플리케이션 설정
# =====================================
WORKDIR /app

# Python 의존성 설치 (직접 설치)
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "pydantic>=2.0.0" \
    "pydantic-settings>=2.0.0"\
    "requests>=2.31.0" \
    "beautifulsoup4>=4.12.0"


# 애플리케이션 코드 복사 (apps 디렉토리 구조 유지)
COPY apps/sandbox /app/apps/sandbox
COPY apps/shared /app/apps/shared

# NSJail 설정 파일 복사
RUN mkdir -p /app/nsjail
COPY apps/sandbox/nsjail/sandbox.cfg /app/nsjail/sandbox.cfg

# 임시 디렉토리 생성
RUN mkdir -p /tmp/sandbox && chmod 777 /tmp/sandbox

# =====================================
# 환경 변수
# =====================================
ENV PYTHONPATH=/app
ENV SANDBOX_NSJAIL_PATH=/usr/bin/nsjail
ENV SANDBOX_NSJAIL_CONFIG_PATH=/app/nsjail/sandbox.cfg
ENV SANDBOX_PYTHON_PATH=/usr/bin/python3

# =====================================
# 실행
# =====================================
EXPOSE 8194

CMD ["uvicorn", "apps.sandbox.main:app", "--host", "0.0.0.0", "--port", "8194"]