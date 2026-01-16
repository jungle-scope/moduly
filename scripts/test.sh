#!/bin/bash

# Moduly 통합 테스트 실행 스크립트
# 사용법: ./scripts/test.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧪 Moduly 통합 테스트 실행 시작...${NC}"

# 에러 발생 시 중단하지 않고 계속 진행 후 마지막에 결과 보고
set +e

echo -e "\n${YELLOW}📍 Gateway Service 테스트 실행${NC}"
(
    cd apps/gateway
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON=".venv/Scripts/python"
    else
        VENV_PYTHON=".venv/bin/python"
    fi
    export PYTHONPATH="$PROJECT_ROOT"
    $VENV_PYTHON -m pip install -e .[dev] > /dev/null 2>&1
    $VENV_PYTHON -m pytest tests
)
GATEWAY_EXIT_CODE=$?

echo -e "\n${YELLOW}📍 Workflow Engine Service 테스트 실행${NC}"
(
    cd apps/workflow_engine
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON=".venv/Scripts/python"
    else
        VENV_PYTHON=".venv/bin/python"
    fi
    export PYTHONPATH="$PROJECT_ROOT"
    $VENV_PYTHON -m pip install -e .[dev] > /dev/null 2>&1
    $VENV_PYTHON -m pytest tests
)
WORKFLOW_EXIT_CODE=$?

echo -e "\n${YELLOW}📍 Shared Library & Unit 테스트 실행 (with Workflow Venv)${NC}"
(
    # OS별 Python 경로 설정
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        VENV_PYTHON="apps/workflow_engine/.venv/Scripts/python"
    else
        VENV_PYTHON="apps/workflow_engine/.venv/bin/python"
    fi
    export PYTHONPATH="$PROJECT_ROOT"
    $VENV_PYTHON -m pytest apps/shared/tests
)
UNIT_EXIT_CODE=$?

echo -e "\n${YELLOW}📍 Client App Build 테스트 실행${NC}"
if [ -d "apps/client" ]; then
    (
        cd apps/client
        npm run build
    )
    CLIENT_EXIT_CODE=$?
else
    echo -e "${YELLOW}⚠️ apps/client 디렉토리가 없어 Client Build 테스트를 건너뜁니다.${NC}"
    CLIENT_EXIT_CODE=0
fi

echo -e "\n${GREEN}============================================${NC}"
echo -e "${GREEN}📊 테스트 결과 요약${NC}"
echo -e "${GREEN}============================================${NC}"

if [ $GATEWAY_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Gateway Service: PASS${NC}"
else
    echo -e "${RED}❌ Gateway Service: FAIL${NC}"
fi

if [ $WORKFLOW_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Workflow Engine Service: PASS${NC}"
else
    echo -e "${RED}❌ Workflow Engine Service: FAIL${NC}"
fi

if [ $UNIT_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Shared/Unit Logic: PASS${NC}"
else
    echo -e "${RED}❌ Shared/Unit Logic: FAIL${NC}"
fi

if [ -d "apps/client" ]; then
    if [ $CLIENT_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ Client App Build: PASS${NC}"
    else
        echo -e "${RED}❌ Client App Build: FAIL${NC}"
    fi
fi

if [ $GATEWAY_EXIT_CODE -eq 0 ] && [ $WORKFLOW_EXIT_CODE -eq 0 ] && [ $UNIT_EXIT_CODE -eq 0 ] && [ $CLIENT_EXIT_CODE -eq 0 ]; then
    exit 0
else
    exit 1
fi
