#!/bin/bash

# Moduly 개발 환경 정리 스크립트
# 사용법: ./scripts/clean.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Moduly 개발 환경 정리를 시작합니다...${NC}"

# 확인 절차
read -p "모든 가상환경(.venv)과 node_modules, 캐시 파일이 삭제됩니다. 계속하시겠습니까? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소되었습니다."
    exit 1
fi

echo ""

# Python Cache 정리
echo "🗑️  Python 캐시 파일(__pycache__, .pytest_cache) 정리 중..."
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type d -name ".pytest_cache" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

# 가상환경 및 의존성 정리 함수
clean_app() {
    local app_path=$1
    local name=$2
    
    if [ -d "$app_path/.venv" ]; then
        echo "🗑️  [$name] 가상환경 삭제 중..."
        rm -rf "$app_path/.venv"
    fi
    
    if [ -d "$app_path/node_modules" ]; then
        echo "🗑️  [$name] node_modules 삭제 중..."
        rm -rf "$app_path/node_modules"
    fi
}

# 각 앱 정리
clean_app "apps/gateway" "Gateway"
clean_app "apps/log_system" "Log System"
clean_app "apps/workflow_engine" "Workflow Engine"
clean_app "apps/client" "Client"

echo -e "${GREEN}✨ 모든 정리가 완료되었습니다!${NC}"
echo -e "다시 시작하려면 ${YELLOW}./scripts/setup.sh${NC} 또는 ${YELLOW}./scripts/dev.sh${NC}를 실행하세요."
