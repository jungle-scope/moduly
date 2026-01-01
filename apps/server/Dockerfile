FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 설치 (PostgreSQL 어댑터 빌드용 등)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY . .

# 포트 노출
EXPOSE 8000

# 서버 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
