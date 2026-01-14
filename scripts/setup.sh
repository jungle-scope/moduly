#!/bin/bash

# Moduly 개발 환경 설정 및 의존성 업데이트 스크립트
# 사용법: ./scripts/setup.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Moduly 개발 환경 설정 및 의존성 업데이트를 시작합니다...${NC}"
echo "프로젝트 루트: $PROJECT_ROOT"
echo ""

# Python 버전 체크
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3가 설치되어 있지 않습니다.${NC}"
    exit 1
fi

# Node.js 버전 체크
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm이 설치되어 있지 않습니다.${NC}"
    exit 1
fi

setup_python_app() {
    local app_name=$1
    local app_path=$2
    local install_shared=$3

    echo -e "${YELLOW}📦 [$app_name] 설정 중...${NC}"
    
    cd "$PROJECT_ROOT/$app_path"

    # 가상환경이 없으면 생성
    if [ ! -d ".venv" ]; then
        echo -e "   - 가상환경(.venv) 생성 중..."
        python3 -m venv .venv
    fi

    # 가상환경 활성화
    source .venv/bin/activate

    # pip 업그레이드
    echo -e "   - pip 업그레이드 중..."
    pip install --upgrade pip > /dev/null

    # Shared 패키지 설치 (필요한 경우)
    if [ "$install_shared" = true ]; then
        echo -e "   - Shared 패키지 설치 중..."
        # shared 패키지가 -e (editable) 모드로 설치되도록 함
        pip install -e "$PROJECT_ROOT/apps/shared" > /dev/null
    fi

    # 의존성 설치
    echo -e "   - 의존성 설치/업데이트 중..."
    pip install -e . > /dev/null

    # 가상환경 비활성화
    deactivate

    echo -e "${GREEN}✓ [$app_name] 설정 완료${NC}"
    echo ""
}

setup_node_app() {
    local app_name=$1
    local app_path=$2

    echo -e "${YELLOW}🌐 [$app_name] 설정 중...${NC}"
    
    cd "$PROJECT_ROOT/$app_path"

    # npm 의존성 설치
    echo -e "   - npm install 실행 중..."
    npm install > /dev/null

    echo -e "${GREEN}✓ [$app_name] 설정 완료${NC}"
    echo ""
}

# 1. Gateway 설정
setup_python_app "Gateway" "apps/gateway" true

# 2. Log System 설정
setup_python_app "Log System" "apps/log_system" true

# 3. Workflow Engine 설정
setup_python_app "Workflow Engine" "apps/workflow_engine" true

# 4. Shared (테스트용 등 필요시) - Shared는 보통 다른 앱에 의존성으로 설치되지만, 
# 독립적인 개발을 위해 venv가 필요할 수도 있음. 여기서는 생략하거나 필요시 추가.

# 5. Client 설정
if [ -d "apps/client" ]; then
    setup_node_app "Client" "apps/client"
else
    echo -e "${YELLOW}⚠️ apps/client 디렉토리가 없어 Client 설정을 건너뜁니다.${NC}"
fi

echo -e "${GREEN}✨ 모든 설정이 완료되었습니다!${NC}"
echo -e "이제 ${YELLOW}./scripts/dev.sh${NC}를 실행하여 개발 환경을 시작할 수 있습니다."
