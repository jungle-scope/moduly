#!/bin/bash
set -e

echo "================================================"
echo "Starting Gateway Service"
echo "================================================"

# DB 연결 대기 함수
wait_for_db() {
    echo "Waiting for PostgreSQL to be ready..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > /dev/null 2>&1; then
            echo "✓ PostgreSQL is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "  Attempt $attempt/$max_attempts: PostgreSQL not ready yet, waiting..."
        sleep 2
    done
    
    echo "✗ PostgreSQL did not become ready in time"
    exit 1
}

# DB 연결 대기
wait_for_db

# pgvector extension 생성
echo ""
echo "Creating pgvector extension..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo "⚠ Warning: Failed to create pgvector extension (may already exist or lack permissions)"
}

# Alembic 마이그레이션 실행
echo ""
echo "Running database migrations..."
cd /app/apps/shared

if alembic upgrade head; then
    echo "✓ Migrations completed successfully"
else
    echo "✗ Migration failed"
    exit 1
fi

echo ""
echo "Starting Uvicorn server..."
echo "================================================"

# Uvicorn 실행 (원래 CMD)
cd /app
exec uvicorn apps.gateway.main:app --host 0.0.0.0 --port 8000
