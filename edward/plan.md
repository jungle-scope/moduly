# FastAPI 모놀리스 마이크로서비스 분리 계획

기존 `apps/server` 모놀리스 서버를 3개의 독립적인 마이크로서비스로 분리하는 상세 구현 계획입니다.

## 1. 현재 모놀리스 구조 분석

### 디렉토리 구조

```
apps/server/
├── main.py                 # FastAPI 앱 진입점
├── lifespan.py             # 앱 라이프사이클 (DB 초기화, 스케줄러, LogWorkerPool)
├── api/
│   ├── api.py              # 12개 라우터 통합
│   └── v1/endpoints/       # 12개 엔드포인트 모듈
│       ├── workflow.py     # 워크플로우 CRUD, 실행, 스트리밍
│       ├── run.py          # 배포된 워크플로우 실행
│       ├── deployment.py   # 배포 관리
│       ├── app.py          # 앱 CRUD
│       ├── auth.py         # 인증
│       ├── llm.py          # LLM 프로바이더
│       ├── knowledge.py    # 지식베이스
│       ├── rag.py          # RAG
│       ├── connectors.py   # 데이터 커넥터
│       ├── health.py       # 헬스체크
│       ├── webhook.py      # 웹훅
│       └── prompt_wizard.py
├── services/               # 비즈니스 로직
│   ├── workflow_service.py
│   ├── deployment_service.py
│   ├── llm_service.py
│   ├── auth_service.py
│   └── ...
├── workflow/
│   ├── core/
│   │   ├── workflow_engine.py    # 워크플로우 실행 엔진
│   │   ├── workflow_logger.py    # 실행 로그
│   │   └── log_worker_pool.py    # 비동기 로그 풀
│   └── nodes/                    # 45개 노드 타입
├── db/
│   ├── session.py          # DB 연결
│   └── models/             # 9개 테이블 모델
└── schemas/                # Pydantic 스키마
```

---

## 2. 마이크로서비스 분리 설계

### 서비스 구조 개요

```
apps/
├── gateway/           # API 게이트웨이 (라우팅, 인증, 프록시)
├── workflow-engine/   # 워크플로우 실행 전용 서비스
├── log-system/        # 로그 수집/저장 서비스
└── shared/            # 공유 코드 (스키마, 모델, 유틸)
```

### 서비스간 통신 방식

| 통신 유형 | 방식                       | 용도                                      |
| --------- | -------------------------- | ----------------------------------------- |
| 동기      | HTTP/gRPC                  | Gateway -> Workflow Engine (실행 요청)    |
| 비동기    | 메시지 큐 (Redis/RabbitMQ) | Workflow Engine -> Log System (로그 전송) |
| 이벤트    | SSE/WebSocket              | Gateway <- Workflow Engine (스트리밍)     |

---

## 3. 상세 설계

> 기존 테이블 구조는 변경하지 않습니다. 모든 서비스가 동일한 PostgreSQL 데이터베이스를 공유합니다.

### 3.1 Gateway 서비스 (`apps/gateway/`)

**역할**: API 진입점, 라우팅, 인증/인가, 요청 검증, 서비스 프록시

#### [NEW] gateway/main.py

```python
# FastAPI 앱, CORS, 세션 미들웨어
# 모든 인증/인가 로직 담당
# Workflow Engine, Log System으로 요청 프록시
```

#### 포함 엔드포인트

| 경로                    | 담당                           | 설명                                             |
| ----------------------- | ------------------------------ | ------------------------------------------------ |
| `/api/v1/auth/*`        | Gateway 직접 처리              | 로그인, OAuth, 토큰                              |
| `/api/v1/apps/*`        | Gateway 직접 처리              | 앱 CRUD                                          |
| `/api/v1/llm/*`         | Gateway 직접 처리              | LLM 프로바이더 관리                              |
| `/api/v1/knowledge/*`   | Gateway 직접 처리              | 지식베이스                                       |
| `/api/v1/rag/*`         | Gateway 직접 처리              | RAG 검색                                         |
| `/api/v1/connectors/*`  | Gateway 직접 처리              | 데이터 커넥터                                    |
| `/api/v1/workflows/*`   | Gateway (CRUD) + 프록시 (실행) | 워크플로우 CRUD는 직접, 실행은 Engine으로 프록시 |
| `/api/v1/deployments/*` | Gateway + 프록시               | 배포 관리는 직접, 실행은 Engine으로 프록시       |
| `/api/v1/run/*`         | Workflow Engine 프록시         | 배포된 워크플로우 실행                           |
| `/health`               | Gateway 직접 처리              | 헬스체크                                         |

#### 디렉토리 구조

```
apps/gateway/
├── main.py
├── lifespan.py
├── config.py                 # 서비스 URL 설정 (ENGINE_URL, LOG_URL)
├── api/
│   ├── api.py
│   └── v1/endpoints/
│       ├── auth.py           # 기존 유지
│       ├── app.py            # 기존 유지
│       ├── llm.py            # 기존 유지
│       ├── knowledge.py      # 기존 유지
│       ├── rag.py            # 기존 유지
│       ├── connectors.py     # 기존 유지
│       ├── workflow.py       # CRUD만 유지, 실행은 프록시
│       ├── deployment.py     # 관리만 유지, 실행은 프록시
│       ├── health.py
│       └── proxy.py          # [NEW] Engine/Log 프록시 핸들러
├── auth/                     # 기존 인증 모듈
├── services/
│   ├── auth_service.py
│   ├── app_service.py
│   ├── llm_service.py
│   ├── workflow_service.py   # CRUD 로직만
│   ├── deployment_service.py # 관리 로직만, 실행은 제외
│   └── ...
├── db/                       # 공유 DB 연결
├── schemas/                  # 공유 스키마
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

---

### 3.2 Workflow Engine 서비스 (`apps/workflow-engine/`)

**역할**: 워크플로우 그래프 실행, 노드 처리, SSE 스트리밍

#### [NEW] workflow-engine/main.py

```python
# 워크플로우 실행 전용 FastAPI 앱
# 외부 직접 접근 불가, Gateway 통해서만 접근
```

#### 담당 기능

- 워크플로우 그래프 로드 및 실행 (`WorkflowEngine`)
- 노드별 실행 (`workflow/nodes/*`)
- SSE 스트리밍 응답
- 배포된 워크플로우 실행

#### 내부 API 엔드포인트

| 경로                              | 메서드 | 설명                         |
| --------------------------------- | ------ | ---------------------------- |
| `/internal/execute/{workflow_id}` | POST   | 워크플로우 동기 실행         |
| `/internal/stream/{workflow_id}`  | POST   | 워크플로우 SSE 스트리밍 실행 |
| `/internal/run/{url_slug}`        | POST   | 배포된 워크플로우 실행       |
| `/health`                         | GET    | 헬스체크                     |

#### 디렉토리 구조

```
apps/workflow-engine/
├── main.py
├── lifespan.py
├── config.py                 # LOG_SYSTEM_URL 설정
├── api/
│   └── v1/endpoints/
│       ├── execute.py        # 실행 엔드포인트
│       └── health.py
├── workflow/
│   ├── core/
│   │   ├── workflow_engine.py    # 기존 유지
│   │   ├── workflow_node_factory.py
│   │   └── utils.py
│   └── nodes/                    # 45개 노드 (기존 유지)
├── services/
│   ├── execution_service.py      # [NEW] 실행 로직 통합
│   └── log_client.py             # [NEW] Log System에 로그 전송
├── db/                           # 공유 DB 연결 (읽기 전용)
├── schemas/
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

#### 로그 전송 방식 변경

기존 `WorkflowLogger`가 직접 DB에 쓰던 것을 Log System API 호출로 변경:

```python
# 기존 (workflow_logger.py)
# session.add(WorkflowRun(...))  # 직접 DB 쓰기

# 변경 후 (log_client.py)
class LogClient:
    async def create_run_log(self, data: dict):
        await httpx.AsyncClient.post(f"{LOG_SYSTEM_URL}/logs/runs", json=data)

    async def update_run_log(self, run_id: str, data: dict):
        await httpx.AsyncClient.patch(f"{LOG_SYSTEM_URL}/logs/runs/{run_id}", json=data)

    async def create_node_log(self, run_id: str, data: dict):
        await httpx.AsyncClient.post(f"{LOG_SYSTEM_URL}/logs/runs/{run_id}/nodes", json=data)
```

---

### 3.3 Log System 서비스 (`apps/log-system/`)

**역할**: 실행 로그 수집, 저장, 집계, 조회

#### [NEW] log-system/main.py

```python
# 로그 전용 FastAPI 앱
# 메시지 큐 또는 HTTP로 로그 수신
```

#### 담당 기능

- 워크플로우 실행 로그 저장 (`WorkflowRun`)
- 노드 실행 로그 저장 (`WorkflowNodeRun`)
- LLM 사용량 로그 저장 (`LLMUsageLog`)
- 대시보드 통계 API
- 로그 조회 API

#### 내부 API 엔드포인트

| 경로                                  | 메서드 | 설명                            |
| ------------------------------------- | ------ | ------------------------------- |
| `/logs/runs`                          | POST   | 워크플로우 실행 로그 생성       |
| `/logs/runs/{run_id}`                 | PATCH  | 실행 로그 업데이트              |
| `/logs/runs/{run_id}/nodes`           | POST   | 노드 로그 생성                  |
| `/logs/runs/{run_id}/nodes/{node_id}` | PATCH  | 노드 로그 업데이트              |
| `/logs/workflows/{workflow_id}/runs`  | GET    | 실행 이력 조회 (Gateway 프록시) |
| `/logs/workflows/{workflow_id}/stats` | GET    | 통계 조회 (Gateway 프록시)      |
| `/health`                             | GET    | 헬스체크                        |

#### 디렉토리 구조

```
apps/log-system/
├── main.py
├── lifespan.py
├── config.py
├── api/
│   └── v1/endpoints/
│       ├── logs.py           # 로그 CRUD
│       ├── stats.py          # 통계 API
│       └── health.py
├── services/
│   ├── log_service.py        # 로그 저장 로직
│   └── stats_service.py      # 통계 집계 로직
├── workers/
│   └── log_worker.py         # [OPTIONAL] 메시지 큐 컨슈머
├── db/                       # 공유 DB 연결
├── schemas/
├── requirements.txt
├── Dockerfile
└── pyproject.toml
```

---

### 3.4 공유 패키지 (`apps/shared/`)

**역할**: 모든 서비스에서 공유하는 코드

```
apps/shared/
├── db/
│   ├── base.py               # SQLAlchemy Base
│   ├── session.py            # DB 연결 설정
│   └── models/               # 모든 테이블 모델
│       ├── app.py
│       ├── workflow.py
│       ├── workflow_run.py   # WorkflowRun, WorkflowNodeRun
│       ├── workflow_deployment.py
│       ├── user.py
│       ├── llm.py
│       ├── knowledge.py
│       └── ...
├── schemas/                  # Pydantic 스키마
│   ├── workflow.py
│   ├── deployment.py
│   ├── log.py
│   └── ...
├── utils/
│   └── common.py
└── pyproject.toml            # 패키지 설정
```

---

## 4. Docker Compose 설정

#### [NEW] docker/docker-compose.microservices.yml

```yaml
services:
  # 기존 인프라
  postgres:
    image: pgvector/pgvector:pg15
    # ... 기존 설정 유지

  redis: # [NEW] 서비스간 통신용
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # 마이크로서비스
  gateway:
    build:
      context: ..
      dockerfile: docker/gateway/Dockerfile
    ports:
      - "8000:8000"
    environment:
      WORKFLOW_ENGINE_URL: http://workflow-engine:8001
      LOG_SYSTEM_URL: http://log-system:8002
      DB_HOST: postgres
    depends_on:
      - postgres
      - workflow-engine
      - log-system

  workflow-engine:
    build:
      context: ..
      dockerfile: docker/workflow-engine/Dockerfile
    ports:
      - "8001:8001" # 내부 전용
    environment:
      LOG_SYSTEM_URL: http://log-system:8002
      DB_HOST: postgres
      SANDBOX_URL: http://sandbox:8194
    depends_on:
      - postgres
      - sandbox

  log-system:
    build:
      context: ..
      dockerfile: docker/log-system/Dockerfile
    ports:
      - "8002:8002" # 내부 전용
    environment:
      DB_HOST: postgres
    depends_on:
      - postgres

  # 기존 서비스
  sandbox:
    # ... 기존 설정 유지
```

---

## 5. 마이그레이션 전략

### Phase 1: 준비 (1주)

1. `apps/shared/` 공유 패키지 생성
2. DB 모델, 스키마를 shared로 이동
3. 기존 모놀리스에서 shared 패키지 참조하도록 수정

### Phase 2: Log System 분리 (1주)

1. `apps/log-system/` 서비스 생성
2. 로그 저장/조회 API 구현
3. `WorkflowLogger`를 `LogClient`로 교체
4. 모놀리스와 병행 운영 테스트

### Phase 3: Workflow Engine 분리 (2주)

1. `apps/workflow-engine/` 서비스 생성
2. 실행 관련 코드 이동 (`workflow/`, 실행 서비스)
3. 내부 API 구현
4. Gateway 프록시 연동 테스트

### Phase 4: Gateway 완성 (1주)

1. `apps/gateway/` 서비스 생성
2. 나머지 엔드포인트 이동
3. 프록시 로직 완성
4. 통합 테스트

### Phase 5: 정리 (1주)

1. 기존 `apps/server/` 제거
2. Docker/K8s 설정 업데이트
3. 문서화

---

## 6. 검증 계획

### 자동화 테스트

```bash
# 각 서비스별 유닛 테스트
pytest apps/gateway/tests/
pytest apps/workflow-engine/tests/
pytest apps/log-system/tests/

# 통합 테스트
pytest tests/integration/
```

### 수동 검증

1. 워크플로우 생성 -> 실행 -> 로그 확인 플로우 테스트
2. SSE 스트리밍 동작 확인
3. 배포된 워크플로우 실행 테스트
4. 대시보드 통계 정상 표시 확인

---

## 7. 고려사항

**트랜잭션 일관성**
서비스가 분리되면 분산 트랜잭션이 필요할 수 있습니다. 현재 설계에서는 동일 DB를 공유하므로 큰 문제는 없지만, 추후 DB 분리 시 Saga 패턴 등 고려 필요.

**스트리밍 프록시**
Gateway가 Workflow Engine의 SSE 응답을 프록시할 때, `StreamingResponse`를 그대로 전달해야 합니다. `httpx.AsyncClient`의 스트리밍 기능 사용.

**개발 환경**
로컬 개발 시에는 모든 서비스를 한 번에 실행하는 스크립트 제공 필요 (`start-all.sh`).
