#!/bin/bash

# =============================================================================
# Moduly 개발 환경 시작 스크립트
# =============================================================================
# 이 스크립트는 Moduly 프로젝트의 전체 개발 환경을 시작합니다.
# - Docker 컨테이너 (PostgreSQL, PgAdmin)
# - 백엔드 서비스 (gateway, workflow-engine, log-system)
# - 프론트엔드 개발 서버 (Next.js)
#
# 사용법: ./start.sh
# =============================================================================

set -e  # 에러 발생 시 스크립트 중단
trap 'kill $(jobs -p)' EXIT  # 스크립트 종료 시 모든 백그라운드 프로세스 종료

# =============================================================================
# 포트 정리 함수
# =============================================================================
# 주어진 포트를 사용 중인 프로세스를 종료합니다.
# 
# 인자:
#   $1: PORT - 확인할 포트 번호
#   $2: PROMPT - 사용자 확인 여부 ("true" or "false")
# =============================================================================
kill_port() {
  PORT=$1
  PROMPT=$2
  # lsof가 실패해도 스크립트가 계속 진행되도록 || true 추가
  PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  
  if [ ! -z "$PID" ]; then
    PROCESS_NAME=$(ps -p $PID -o comm=)
    if [ "$PROMPT" = "true" ]; then
        read -p "이 프로세스를 종료하고 진행하시겠습니까? (y/n): " confirm
        if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
            return
        fi
    fi
    echo "포트 $PORT 사용 중인 프로세스 종료 (PID: $PID)"
    kill -9 $PID 2>/dev/null || true
  fi
}

# =============================================================================
# 1단계: 포트 정리
# =============================================================================
echo "=== 1단계: 포트 정리 시작 ==="
kill_port 8000 "false"  # Gateway
kill_port 8001 "false"  # Workflow Engine
kill_port 8002 "false"  # Log System
kill_port 3000 "false"  # Frontend
echo "포트 정리 완료"
echo ""

# =============================================================================
# 2단계: Docker 컨테이너 시작
# =============================================================================
echo "=== 2단계: Docker 컨테이너 시작 ==="
echo "Docker 컨테이너 시작 중..."
docker compose up -d || {
    echo "에러: Docker compose up 실패"
    exit 1
}

echo "Docker 컨테이너가 준비될 때까지 대기 중..."
max_wait=60
wait_time=0
while [ $wait_time -lt $max_wait ]; do
    if docker compose ps | grep -q "healthy\|Up"; then
        echo "Docker 컨테이너 준비 완료"
        sleep 2  # 추가 안정화 시간
        break
    fi
    sleep 2
    wait_time=$((wait_time + 2))
    if [ $wait_time -ge $max_wait ]; then
        echo "경고: Docker 컨테이너 헬스체크 타임아웃 (계속 진행)"
    fi
done
echo ""

# =============================================================================
# 백엔드 서비스 실행 함수
# =============================================================================
# Python FastAPI 서비스를 시작합니다.
# - 가상환경이 없으면 생성
# - 의존성 패키지 설치
# - Uvicorn으로 서비스 시작 (백그라운드)
#
# 인자:
#   $1: SERVICE_NAME - 서비스 이름 (gateway, workflow-engine, log-system)
# =============================================================================
run_service() {
    SERVICE_NAME=$1

    echo ">>> ${SERVICE_NAME} 서비스 시작 중..."
    
    # 서비스 디렉토리로 이동
    cd apps/${SERVICE_NAME} || {
        echo "에러: apps/${SERVICE_NAME} 디렉토리를 찾을 수 없습니다"
        exit 1
    }
    
    # 가상환경 설정
    if [ ! -d ".venv" ]; then
        echo "  - 가상환경이 없습니다. 새로 생성합니다..."
        python3 -m venv .venv || {
            echo "에러: 가상환경 생성 실패"
            exit 1
        }
        source .venv/bin/activate
        
        echo "  - pip 업그레이드 중..."
        pip install --upgrade pip || {
            echo "에러: pip 업그레이드 실패"
            exit 1
        }
        
        # shared 패키지 설치
        if [ -d "../shared" ]; then
            echo "  - shared 패키지 설치 중..."
            pip install -e ../shared || {
                echo "에러: shared 패키지 설치 실패"
                exit 1
            }
        fi
        
        # 서비스 의존성 설치
        echo "  - ${SERVICE_NAME} 의존성 설치 중..."
        pip install -e ".[dev]" || {
            echo "에러: ${SERVICE_NAME} 패키지 설치 실패"
            exit 1
        }
    else
        echo "  - 기존 가상환경 활성화..."
        source .venv/bin/activate
        
        # shared 패키지 재설치 (변경사항 반영을 위해)
        if [ -d "../shared" ]; then
            echo "  - shared 패키지 업데이트 중..."
            pip install -e ../shared || {
                echo "에러: shared 패키지 설치 실패"
                exit 1
            }
        fi
        
        # 서비스 의존성 재설치
        echo "  - ${SERVICE_NAME} 의존성 업데이트 중..."
        pip install -e ".[dev]" || {
            echo "에러: ${SERVICE_NAME} 패키지 설치 실패"
            exit 1
        }
    fi
    
    # 포트 설정
    if [ "${SERVICE_NAME}" == "gateway" ]; then
        PORT=8000
    elif [ "${SERVICE_NAME}" == "workflow-engine" ]; then
        PORT=8001
    elif [ "${SERVICE_NAME}" == "log-system" ]; then
        PORT=8002
    else
        echo "에러: 알 수 없는 서비스 이름: ${SERVICE_NAME}"
        exit 1
    fi

    # 서비스 시작 (백그라운드)
    uvicorn main:app --host 0.0.0.0 --port $PORT --reload &
    PID=$!
    echo "  - ${SERVICE_NAME} 시작됨 (PID: $PID, PORT: $PORT)"
    
    # 원래 디렉토리로 복귀
    cd ../..
    echo ""
}

# =============================================================================
# 3단계: 백엔드 서비스 시작
# =============================================================================
echo "=== 3단계: 백엔드 서비스 시작 ==="
run_service "gateway"
run_service "workflow-engine"
run_service "log-system"

# =============================================================================
# 4단계: 프론트엔드 설정 및 시작
# =============================================================================
echo "=== 4단계: 프론트엔드 설정 및 시작 ==="
echo ">>> 프론트엔드 의존성 설치 중..."
cd apps/client || {
    echo "에러: apps/client 디렉토리를 찾을 수 없습니다"
    exit 1
}

npm install || {
    echo "에러: npm install 실패"
    exit 1
}
echo "의존성 설치 완료"
cd ../..
echo ""

# =============================================================================
# 5단계: 프론트엔드 개발 서버 시작
# =============================================================================
echo "=== 5단계: 프론트엔드 개발 서버 시작 ==="
echo ">>> 프론트엔드 개발 서버 시작 중..."
echo "5초 후 브라우저가 자동으로 열립니다..."
(sleep 5 && open "http://localhost:3000") &

cd apps/client || exit 1
npm run dev || {
    echo "에러: npm run dev 실패"
    exit 1
}
