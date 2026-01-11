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

# 1. 백엔드 환경 확인 및 설정 (현재 터미널)
echo "🐍 백엔드 환경 확인 중..."
cd apps/server
if [ ! -d ".venv" ]; then
    echo "가상 환경 생성 중..."
    python3 -m venv .venv
    source .venv/bin/activate
else
    source .venv/bin/activate
fi
# 항상 의존성 최신화 (변경 사항 없으면 빠름)
echo "📥 백엔드 패키지 설치/업데이트 중..."
pip install -r requirements.txt
cd ../.. # 루트 경로로 복귀

# 2. 프론트엔드 환경 확인 (패키지 설치)
echo "⚛️  프론트엔드 패키지 설치/업데이트 중..."
cd apps/client
npm install
cd ../..

# 3. 브라우저 자동 실행 (5초 후)
# 서버가 켜질 때까지 잠시 기다렸다가 실행
(sleep 5 && open "http://localhost:3000") &

# 4. Concurrently를 사용하여 서버 일괄 실행
echo "🚀 서버 실행 중..."
cd apps/client
npm run dev:all
