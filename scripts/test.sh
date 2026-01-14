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
    source apps/gateway/.venv/bin/activate
    export PYTHONPATH="$PROJECT_ROOT"
    pytest apps/gateway/tests
)
GATEWAY_EXIT_CODE=$?

echo -e "\n${YELLOW}📍 Workflow Engine Service 테스트 실행${NC}"
(
    source apps/workflow_engine/.venv/bin/activate
    export PYTHONPATH="$PROJECT_ROOT"
    pytest apps/workflow_engine/tests
)
WORKFLOW_EXIT_CODE=$?

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

if [ $GATEWAY_EXIT_CODE -eq 0 ] && [ $WORKFLOW_EXIT_CODE -eq 0 ]; then
    exit 0
else
    exit 1
fi
