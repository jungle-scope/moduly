#!/bin/bash

# Moduly 로컬 개발 환경 실행 스크립트
# 사용법: ./scripts/dev.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Moduly 개발 환경 시작..."
echo "프로젝트 루트: $PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 정리 함수 (Ctrl+C 시 모든 프로세스 종료)
cleanup() {
    echo -e "\n${YELLOW}🛑 모든 서비스 종료 중...${NC}"
    
    # 모든 백그라운드 프로세스 종료
    if [ ! -z "$DOCKER_PID" ]; then
        kill $DOCKER_PID 2>/dev/null || true
    fi
    if [ ! -z "$CELERY_PID" ]; then
        kill $CELERY_PID 2>/dev/null || true
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

# 1. Docker Compose (PostgreSQL + Redis)
echo -e "${GREEN}📦 인프라 시작 (PostgreSQL + Redis)...${NC}"
docker compose up postgres redis &
DOCKER_PID=$!

# Docker 서비스가 준비될 때까지 대기
echo "⏳ 데이터베이스 준비 대기 중..."
sleep 5

# 2. Celery Worker (Log-System)
# macOS에서 fork() 호환성 문제 해결을 위해 solo pool 사용 및 환경변수 설정
echo -e "${GREEN}📝 Log-System Celery Worker 시작...${NC}"
(
    source apps/server/.venv/bin/activate
    export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
    PYTHONPATH="$PROJECT_ROOT" celery -A apps.log_system.main worker -Q log -l info -P solo
) &
CELERY_PID=$!

sleep 2

# 3. FastAPI 서버
echo -e "${GREEN}🖥️ FastAPI 서버 시작...${NC}"
(
    cd apps/server
    source .venv/bin/activate
    PYTHONPATH="$PROJECT_ROOT" uvicorn main:app --reload --port 8000
) &
FASTAPI_PID=$!

sleep 2

# 4. Next.js 클라이언트 (선택)
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
echo -e "${GREEN}🎉 Moduly 개발 환경이 시작되었습니다!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "📌 접속 URL:"
echo "   - API:        http://localhost:8000"
echo "   - API 문서:   http://localhost:8000/docs"
echo "   - 프론트엔드: http://localhost:3000"
echo ""
echo "👤 기본 로그인 계정:"
echo "   - 이메일:     dev@moduly.app"
echo "   - 비밀번호:   dev-password"
echo ""
echo -e "${YELLOW}Ctrl+C를 누르면 모든 서비스가 종료됩니다.${NC}"
echo ""

# 모든 백그라운드 프로세스 대기
wait
