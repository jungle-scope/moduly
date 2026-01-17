#!/bin/bash

# Moduly 로컬 개발 환경 실행 스크립트
# 사용법: ./scripts/dev.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Moduly 개발 환경 시작..."
echo "프로젝트 루트: $PROJECT_ROOT"

# 가상환경 체크 및 자동 설정
if [ ! -d "apps/gateway/.venv" ] || [ ! -d "apps/log_system/.venv" ] || [ ! -d "apps/workflow_engine/.venv" ]; then
    echo -e "${YELLOW}⚠️ 일부 가상환경이 발견되지 않았습니다. 초기 설정을 진행합니다...${NC}"
    ./scripts/setup.sh
    echo -e "${GREEN}✨ 초기 설정 완료! 서비스를 시작합니다.${NC}"
fi

# 정리 함수 (Ctrl+C 시 모든 프로세스 종료)
cleanup() {
    echo -e "\n${YELLOW}🔥 모든 서비스 종료 중...${NC}"
    
    # 모든 백그라운드 프로세스 종료
    if [ ! -z "$DOCKER_PID" ]; then
        kill $DOCKER_PID 2>/dev/null || true
    fi
    if [ ! -z "$LOG_CELERY_PID" ]; then
        kill $LOG_CELERY_PID 2>/dev/null || true
    fi
    if [ ! -z "$WORKFLOW_CELERY_PID" ]; then
        kill $WORKFLOW_CELERY_PID 2>/dev/null || true
    fi
    if [ ! -z "$FASTAPI_PID" ]; then
        kill $FASTAPI_PID 2>/dev/null || true
    fi
    if [ ! -z "$CLIENT_PID" ]; then
        kill $CLIENT_PID 2>/dev/null || true
    fi
    
    # Docker Compose 종료
    docker compose down 2>/dev/null || true
    
    echo -e "${GREEN}✅ 모든 서비스 종료 완료${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM


# 1. Docker Compose (PostgreSQL + Redis + Sandbox) - detached 모드로 시작
echo -e "${GREEN}📦 인프라 시작 (PostgreSQL + Redis + Sandbox)...${NC}"
docker compose up -d postgres redis pgadmin sandbox

# PostgreSQL이 준비될 때까지 대기 (최대 30초)
echo "⏳ PostgreSQL 준비 대기 중..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U admin -d moduly_local > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL 준비 완료${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ PostgreSQL 시작 실패${NC}"
        exit 1
    fi
    sleep 1
done

# Redis가 준비될 때까지 대기 (최대 10초)
echo "⏳ Redis 준비 대기 중..."
for i in {1..10}; do
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis 준비 완료${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Redis 시작 실패${NC}"
        exit 1
    fi
    sleep 1
done

# Sandbox가 준비될 때까지 대기 (최대 60초 - 빌드 포함)
echo "⏳ Sandbox 준비 대기 중..."
for i in {1..60}; do
    if curl -s http://localhost:8194/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Sandbox 준비 완료${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${YELLOW}⚠️ Sandbox 시작 지연 - 백그라운드에서 계속 시작됩니다${NC}"
    fi
    sleep 1
done

# Docker Compose 로그를 백그라운드에서 표시
docker compose logs -f postgres redis sandbox &
DOCKER_PID=$!

# 2. Celery Worker (Log-System)
# macOS에서 fork() 호환성 문제 해결을 위해 solo pool 사용 및 환경변수 설정
echo -e "${GREEN}📝 Log-System Celery Worker 시작...${NC}"
(
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON="apps/log_system/.venv/Scripts/python"
    else
        VENV_PYTHON="apps/log_system/.venv/bin/python"
    fi
    export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
    PYTHONPATH="$PROJECT_ROOT" $VENV_PYTHON -m celery -A apps.log_system.main worker -Q log -l info -P solo
) &
LOG_CELERY_PID=$!

sleep 1

# 3. Celery Worker (Workflow-Engine)
echo -e "${GREEN}⚙️ Workflow-Engine Celery Worker 시작...${NC}"
(
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON="apps/workflow_engine/.venv/Scripts/python"
    else
        VENV_PYTHON="apps/workflow_engine/.venv/bin/python"
    fi
    export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
    PYTHONPATH="$PROJECT_ROOT" $VENV_PYTHON -m celery -A apps.workflow_engine.main worker -Q workflow -l info -P solo
) &
WORKFLOW_CELERY_PID=$!

sleep 1

# 4. Gateway API 서버
echo -e "${GREEN}🖥️ Gateway API 서버 시작...${NC}"
(
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON="apps/gateway/.venv/Scripts/python"
    else
        VENV_PYTHON="apps/gateway/.venv/bin/python"
    fi
    PYTHONPATH="$PROJECT_ROOT" $VENV_PYTHON -m uvicorn apps.gateway.main:app --reload --port 8000
) &
FASTAPI_PID=$!

sleep 2

# 5. Next.js 클라이언트 (선택)
if [ -d "apps/client" ]; then
    echo -e "${GREEN}🌐 Next.js 클라이언트 시작...${NC}"
    (
        cd apps/client
        npm run dev
    ) &
    CLIENT_PID=$!
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ 모듈리 개발 환경이 시작되었습니다!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "📌 접속 URL:"
echo "   - API:        http://localhost:8000"
echo "   - API 문서:   http://localhost:8000/docs"
echo "   - 프론트엔드: http://localhost:3000"
echo "   - Sandbox:    http://localhost:8194"
echo "   - pgAdmin:    http://localhost:5050"
echo ""
echo -e "${YELLOW}Ctrl+C를 누르면 모든 서비스가 종료됩니다.${NC}"
echo ""

# 모든 백그라운드 프로세스 대기
wait
