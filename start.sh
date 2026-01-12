#!/bin/bash

# 이 스크립트가 종료되면 백엔드, 프론트엔드 서버가 알아서 같이 꺼짐
trap 'kill $(jobs -p)' EXIT

# 특정 포트의 프로세스를 종료하는 함수 (확인 메시지 옵션 포함)
kill_port() {
  PORT=$1
  PROMPT=$2 # true일 경우 사용자 확인 필요
  PID=$(lsof -ti tcp:$PORT)
  
  if [ ! -z "$PID" ]; then
    PROCESS_NAME=$(ps -p $PID -o comm=)
    echo "⚠️  포트 $PORT 가 PID $PID ($PROCESS_NAME) 에 의해 사용 중입니다."

    if [ "$PROMPT" = "true" ]; then
        read -p "❓ 이 프로세스를 종료하고 진행하시겠습니까? (y/n): " confirm
        if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
            echo "❌ 프로세스가 종료되지 않았습니다. Docker 실행에 실패할 수 있습니다."
            return
        fi
    fi

    echo "🔪 PID $PID 종료 중..."
    kill -9 $PID
  fi
}

echo "🧹 포트 정리 중..."
kill_port 8000 "false" # 백엔드 (개발 서버는 켜기 전에 항상 종료)
kill_port 3000 "false" # 프론트엔드 (개발 서버는 켜기 전에 항상 종료)

# Docker 포트 확인 및 정리
# 로컬 데이터베이스 종료 전 사용자에게 확인
kill_port 5432 "true"
kill_port 5050 "true"

# .env 파일 확인 및 생성 함수
# .env 파일 확인 및 생성 함수
# check_env() {
#     DIR=$1
#     if [ ! -f "$DIR/.env" ]; then
#         echo "⚠️  $DIR/.env 파일을 찾을 수 없습니다."
#         if [ -f "$DIR/.env.example" ]; then
#             echo "✨ $DIR/.env.example 파일을 복사하여 .env 파일을 생성합니다..."
#             cp "$DIR/.env.example" "$DIR/.env"
#         # .env.example이 없으면 빈 파일이라도 생성 (오류 방지)
#         else
#             echo "📝 빈 .env 파일을 생성합니다..."
#             touch "$DIR/.env"
#         fi
#     fi
# }

# echo "🔍 환경 설정 파일(.env) 검사 중..."
# check_env "apps/server"
# check_env "apps/client"

echo "🚀 Moduly 개발 환경 설정 중..."

# 0. Docker 컨테이너 실행 확인
echo "🐳 데이터베이스 컨테이너 확인 중..."
docker compose up -d

# 1. 백엔드 서비스 실행 (Gateway, Workflow Engine, Log System)
echo "🐍 백엔드 서비스 실행 준비 중..."

# 공통 함수: 서비스 실행
run_service() {
    SERVICE_NAME=$1
    echo "-------- [${SERVICE_NAME}] 시작 --------"
    cd apps/${SERVICE_NAME} || exit

    # 가상환경 확인 및 생성
    if [ ! -d ".venv" ]; then
        echo "Creating .venv for ${SERVICE_NAME}..."
        python3 -m venv .venv
        source .venv/bin/activate
        pip install --upgrade pip
        
        # Shared 패키지 설치 (먼저 설치)
        if [ -d "../shared" ]; then
             echo "Installing local shared package..."
             pip install -e ../shared
        fi

        # 의존성 설치 (Editable mode + Dev dependencies)
        pip install -e ".[dev]"
    else
        source .venv/bin/activate
        # 의존성 업데이트 (변경 사항 있을 때만 설치됨)
        if [ -d "../shared" ]; then
             pip install -e ../shared
        fi
        pip install -e ".[dev]"
    fi

    # 백그라운드로 실행
    if [ "${SERVICE_NAME}" == "gateway" ]; then
        PORT=8000
    elif [ "${SERVICE_NAME}" == "workflow-engine" ]; then
        PORT=8001
    elif [ "${SERVICE_NAME}" == "log-system" ]; then
        PORT=8002
    fi
    
    # nohup 등을 사용하지 않고 단순히 백그라운드로 실행 (개발용)
    # 실제 운영 환경에서는 supervisor나 docker compose 권장
    uvicorn main:app --host 0.0.0.0 --port $PORT --reload &
    
    cd ../..
    echo "-------- [${SERVICE_NAME}] 실행 완료 (Port: $PORT) --------"
}

# Shared 패키지 설치 (각 서비스에서 참조하기 위해 필요할 수 있음, 또는 각 서비스의 toml에서 참조)
# 여기서는 각 서비스가 로컬 shared를 참조하므로, 각 서비스 venv에서 install -e . 하면 됨.

run_service "gateway"
run_service "workflow-engine"
run_service "log-system"

# 2. 프론트엔드 환경 확인 (패키지 설치)
echo "⚛️  프론트엔드 패키지 설치/업데이트 중..."
cd apps/client
npm install
cd ../..

# 3. 브라우저 자동 실행 (5초 후)
# 서버가 켜질 때까지 잠시 기다렸다가 실행
(sleep 5 && open "http://localhost:3000") &

# 4. 프론트엔드 실행
echo "🚀 프론트엔드 실행 중..."
cd apps/client
npm run dev
