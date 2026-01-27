# 1. OS 감지 로직
ifeq ($(OS),Windows_NT)
    # Windows (Git Bash / WSL / CMD)
    VENV_BIN := Scripts
    PYTHON := python
else
    # Mac / Linux
    VENV_BIN := bin
    PYTHON := python3
endif

# 2. 경로 변수 설정
GATEWAY_PIP := ../apps/gateway/.venv/$(VENV_BIN)/pip
WORKFLOW_PIP := ../apps/workflow_engine/.venv/$(VENV_BIN)/pip
CLIENT_DIR := ../apps/client
SHARED_DIR := ../apps/shared

.PHONY: all setup-gateway setup-workflow setup-client migrate test dev

# [전체 실행] 순차적으로 실행
all: setup-gateway setup-workflow setup-client migrate test dev
	@echo "✨ [성공] 모든 단계가 완료되었습니다!"

# 1. Gateway Service 설치
setup-gateway:
	@echo ">>> [1/6] Gateway 설치 시작..."
	@$(GATEWAY_PIP) install -e $(SHARED_DIR) && $(GATEWAY_PIP) install -e ../apps/gateway \
		|| (echo "❌ Gateway 에러"; exit 1)
	@echo "✅ Gateway 완료."

# 2. Workflow Engine Service 설치
setup-workflow:
	@echo ">>> [2/6] Workflow Engine 설치 시작..."
	@$(WORKFLOW_PIP) install -e $(SHARED_DIR) && $(WORKFLOW_PIP) install -e ../apps/workflow_engine \
		|| (echo "❌ Workflow Engine 에러"; exit 1)
	@echo "✅ Workflow Engine 완료."

# 3. Client App 설치
setup-client:
	@echo ">>> [3/6] Client App 설치 시작..."
	@(cd $(CLIENT_DIR) && npm install) \
		|| (echo "❌ Client 에러"; exit 1)
	@echo "✅ Client 완료."

# 4. DB Migration (Alembic)
migrate:
	@echo ">>> [4/6] DB 마이그레이션 시작..."
	@(cd $(SHARED_DIR) && ../gateway/.venv/$(VENV_BIN)/alembic current && ../gateway/.venv/$(VENV_BIN)/alembic upgrade head) \
		|| (echo "❌ 마이그레이션 에러"; exit 1)
	@echo "✅ 마이그레이션 완료."

# 5. 테스트 실행
test:
	@echo ">>> [5/6] 테스트 코드 실행..."
	@../scripts/test.sh \
		|| (echo "❌ 테스트 에러"; exit 1)
	@echo "✅ 테스트 통과."

# 6. 프로젝트 실행
dev:
	@echo ">>> [6/6] 프로젝트 실행..."
	@../scripts/dev.sh || (echo "❌ 실행 에러"; exit 1)