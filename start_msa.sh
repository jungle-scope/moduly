#!/bin/bash

# start_msa.sh
# 개발용 MSA 서비스 실행 스크립트 (하이브리드 모드)
# DB/Redis는 Docker로, MSA 서비스(Python)는 Host 프로세스로 실행합니다.

trap 'kill $(jobs -p)' EXIT

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Moduly MSA 개발 환경을 시작합니다...${NC}"

# 1. 포트 정리 (8000, 8001, 8002)
kill_port() {
  PORT=$1
  PID=$(lsof -ti tcp:$PORT)
  if [ ! -z "$PID" ]; then
    echo -e "${RED}🔪 포트 $PORT (PID $PID) 종료 중...${NC}"
    kill -9 $PID
  fi
}
echo -e "${BLUE}🧹 기존 포트 정리 중...${NC}"
kill_port 8000 # Gateway
kill_port 8001 # Workflow Engine
kill_port 8002 # Log System (API)

# 2. 인프라 실행 (Docker Compose)
echo -e "${BLUE}🐳 인프라(DB, Redis) 실행 중...${NC}"
docker compose up -d redis postgres

# 3. 각 서비스 실행 함수
run_service() {
    SERVICE_NAME=$1
    SERVICE_DIR=$2
    PORT=$3
    CMD=$4

    echo -e "${GREEN}🐍 [$SERVICE_NAME] 시작 준비...${NC}"
    
    cd "$SERVICE_DIR" || exit

    # 가상환경 확인 및 생성
    if [ ! -d ".venv" ]; then
        echo "   [$SERVICE_NAME] 가상환경 생성 중..."
        python3 -m venv .venv
        source .venv/bin/activate
        echo "   [$SERVICE_NAME] 의존성 설치 중..."
        pip install -e ../shared
        pip install -e .
    else
        source .venv/bin/activate
        # 의존성 변경 사항이 있을 수 있으니 가볍게 install (이미 만족하면 빠름)
        echo "   [$SERVICE_NAME] 의존성 업데이트 확인 중..."
        pip install -e ../shared
        pip install -e .
    fi

    echo -e "   [$SERVICE_NAME] 서버 실행 (Port: $PORT)..."
    # 백그라운드 실행
    # 절대 경로로 PYTHONPATH 설정
    export PYTHONPATH=$(pwd)/../..
    $CMD &

    # Celery Worker 실행 추가 (Workflow Engine 필수)
    echo -e "   [$SERVICE_NAME] Celery Worker 실행..."
    celery -A worker worker -Q workflow --loglevel=info &
    
    cd - > /dev/null || exit
}

# 4. 서비스 병렬 실행
# Gateway (8000)
run_service "Gateway" "apps/gateway" 8000 "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

# Workflow Engine (8001)
run_service "WorkflowEngine" "apps/workflow_engine" 8001 "uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

# Log System (8002 + Celery)
SERVICE_NAME="LogSystem"
cd apps/log_system || exit
# Venv 재설치 필요 여부 확인 (이전 폴더명 변경 이슈 대응)
if [ ! -d ".venv" ]; then
    echo -e "🐍 [$SERVICE_NAME] 가상환경 생성 중..."
    python3 -m venv .venv
    source .venv/bin/activate
    echo -e "   [$SERVICE_NAME] 의존성 설치 중..."
    pip install -e ../shared
    pip install -e .
else
    source .venv/bin/activate
    echo -e "   [$SERVICE_NAME] 의존성 업데이트 확인 중..."
    pip install -e ../shared
    pip install -e .
fi

echo -e "   [$SERVICE_NAME] 시작 준비..."
PORT=8002
# 포트 점유 확인 및 정리
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
    echo -e "🧹 Port $PORT (PID: $PID) 정리 중..."
    kill -9 $PID 2>/dev/null
fi
echo -e "   [$SERVICE_NAME] API 서버 실행 (Port: $PORT)..."
export PYTHONPATH=$(pwd)/../..
uvicorn main:app --host 0.0.0.0 --port 8002 --reload &
echo -e "   [$SERVICE_NAME] Celery Worker 실행..."
celery -A worker worker --loglevel=info &

cd - > /dev/null || exit

# 4. Next.js Client (3000)
echo -e "${GREEN}🖥️  [Client] 시작 준비...${NC}"
cd apps/client || exit
PORT=3000
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
   echo -e "🧹 Port $PORT (PID: $PID) 정리 중..."
   kill -9 $PID 2>/dev/null
fi
echo -e "   [Client] 개발 서버 실행 (Port: $PORT)..."
npm run dev &
cd - > /dev/null || exit


echo -e "${GREEN}✅ 모든 서비스가 백그라운드에서 실행되었습니다.${NC}"
echo -e "${BLUE}📜 로그를 보려면 'tail -f'를 사용하거나, 각 서비스 터미널을 따로 띄우는 것이 좋습니다.${NC}"
echo -e "종료하려면 Ctrl+C를 누르세요."

# 자식 프로세스 대기 (Ctrl+C로 종료될 때까지 유지)
wait
