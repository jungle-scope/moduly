#!/bin/bash
# ============================================================
# Sandbox Load Test Runner
# ============================================================
#
# ⚠️  주의: FIFO/SJF 모드 전환은 서버 측 환경변수입니다!
#     이 스크립트는 Locust 테스트만 실행합니다.
#     서버에서 SANDBOX_FORCE_FIFO=true/false 설정 후 재시작 필요
#
# 사용법:
#   ./run_ab_test.sh              # 기본 설정
#   ./run_ab_test.sh 50 10 3m     # 50명, 10명/초, 3분
#   ./run_ab_test.sh 30 5 2m sjf  # 결과 파일명에 sjf 붙임
#
# Windows (Git Bash):
#   bash tests/load/run_ab_test.sh
# ============================================================

set -e

# 파라미터
USERS=${1:-30}
SPAWN_RATE=${2:-5}
DURATION=${3:-2m}
TEST_NAME=${4:-test}

# 호스트 설정 (환경변수로 오버라이드 가능)
HOST=${SANDBOX_HOST:-http://localhost:8001}

# 스크립트 디렉토리 (Windows/Linux 호환)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo ""
echo "============================================================"
echo "  Sandbox Load Test"
echo "============================================================"
echo "  Host:       ${HOST}"
echo "  Users:      ${USERS}"
echo "  Spawn Rate: ${SPAWN_RATE}/sec"
echo "  Duration:   ${DURATION}"
echo "  Test Name:  ${TEST_NAME}"
echo "============================================================"
echo ""
echo "  ⚠️  FIFO/SJF 모드는 서버 측에서 설정해야 합니다!"
echo "      서버 실행 시: SANDBOX_FORCE_FIFO=true python -m apps.sandbox.main"
echo ""
echo "============================================================"
echo ""

# 결과 디렉토리 생성
mkdir -p "${RESULTS_DIR}"

# 서버 헬스 체크
echo "Checking server health..."
if ! curl -s "${HOST}/v1/sandbox/health" > /dev/null 2>&1; then
    echo "❌ Error: Cannot connect to ${HOST}"
    echo "   Please make sure the sandbox server is running."
    exit 1
fi
echo "✅ Server is healthy"
echo ""

# Locust 실행
echo "Starting load test..."
locust -f "${SCRIPT_DIR}/sandbox_locust.py" \
    --host="${HOST}" \
    --headless \
    -u "${USERS}" \
    -r "${SPAWN_RATE}" \
    -t "${DURATION}" \
    --csv="${RESULTS_DIR}/${TEST_NAME}_${TIMESTAMP}" \
    --html="${RESULTS_DIR}/${TEST_NAME}_${TIMESTAMP}.html"

echo ""
echo "============================================================"
echo "  ✅ Test Completed!"
echo "============================================================"
echo ""
echo "  Results:"
echo "    - ${RESULTS_DIR}/${TEST_NAME}_${TIMESTAMP}_stats.csv"
echo "    - ${RESULTS_DIR}/${TEST_NAME}_${TIMESTAMP}.html"
echo ""
echo "============================================================"
