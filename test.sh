#!/bin/bash

set -e  # 에러 발생 시 중단

echo "==================================="
echo "🧪 Running Frontend Tests..."
echo "==================================="
cd apps/client && npm test -- --run
cd ../..

echo ""
echo "==================================="
echo "🧪 Running Backend Tests..."
echo "==================================="

run_backend_test() {
    SERVICE_NAME=$1
    echo "➡️  Testing ${SERVICE_NAME}..."
    cd apps/${SERVICE_NAME}
    
    # 가상환경 확인 및 활성화
    if [ -f ".venv/bin/activate" ]; then
        source .venv/bin/activate
    elif [ -f ".venv/Scripts/activate" ]; then
        source .venv/Scripts/activate
    else
        echo "⚠️  Cannot find virtual environment for ${SERVICE_NAME}. Skipping..."
        cd ../..
        return
    fi
    
    # 의존성 설치 (테스트 전 확실히 하기 위함, 선택사항)
    # pip install -e .
    
    # 테스트 실행
    # -v: 상세 출력, -s: stdout 출력 허용
    # 테스트 실행
    # -v: 상세 출력, -s: stdout 출력 허용
    set +e
    python -m pytest -vs
    EXIT_CODE=$?
    set -e
    
    if [ $EXIT_CODE -eq 5 ]; then
        echo "⚠️  No tests collected for ${SERVICE_NAME}."
    elif [ $EXIT_CODE -ne 0 ]; then
        echo "❌ Tests failed for ${SERVICE_NAME} with exit code ${EXIT_CODE}"
        exit 1
    fi
    
    deactivate
    cd ../..
    echo "✅ ${SERVICE_NAME} Tests Completed"
    echo "-----------------------------------"
}

# 순서대로 테스트 실행 (shared가 가장 먼저 테스트되어야 함)
run_backend_test "shared"
run_backend_test "gateway"
run_backend_test "workflow-engine"
run_backend_test "log-system"

echo ""
echo "==================================="
echo "✅ All Tests Completed!"
echo "==================================="
