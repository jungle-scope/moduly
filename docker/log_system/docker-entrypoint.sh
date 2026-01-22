#!/bin/bash
set -e

echo "================================================"
echo "Starting Log System (Celery Worker)"
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

# Redis 연결 대기 함수
wait_for_redis() {
    echo "Waiting for Redis to be ready..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
            echo "✓ Redis is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo "  Attempt $attempt/$max_attempts: Redis not ready yet, waiting..."
        sleep 2
    done
    
    echo "✗ Redis did not become ready in time"
    exit 1
}

# DB 연결 대기
wait_for_db

# Redis 연결 대기
wait_for_redis

echo ""
echo "Starting Celery worker for logging..."
echo "================================================"

# Celery 워커 실행
cd /app
exec celery -A apps.log_system.main worker \
    --loglevel=info \
    --queues=log \
    --concurrency=2 \
    --max-tasks-per-child=100


