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
cd apps/server
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    source .venv/Scripts/activate
else
    echo "⚠️  Cannot find virtual environment. Skipping activation..."
fi
python -m pytest -vs
deactivate  # 가상환경 비활성화 (함수라서 source 불필요)
cd ../..

echo ""
echo "==================================="
echo "✅ All Tests Completed!"
echo "==================================="
