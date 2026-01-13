# FastAPI 마이크로서비스 분리 구현 계획

## 개요

현재 `apps/server/`에 위치한 FastAPI 모놀리스 서버를 3개의 독립적인 마이크로서비스로 분리합니다:

| 서비스          | 디렉토리                | 포트 | 역할                                             |
| --------------- | ----------------------- | ---- | ------------------------------------------------ |
| Gateway         | `apps/gateway/`         | 8000 | API 게이트웨이, 라우팅, 인증                     |
| Workflow Engine | `apps/workflow-engine/` | -    | Celery Worker로 워크플로우 실행 (HTTP 서버 없음) |
| Log System      | `apps/log-system/`      | 8002 | 로그 수집 및 저장                                |

**공유 로직**: `apps/shared/` - DB 모델, 스키마, Celery 설정 등 3개 서비스가 공통으로 사용하는 모듈

> [!NOTE]
> Workflow Engine은 HTTP 서버 없이 **Celery Worker**로만 동작합니다.
> 실시간 스트리밍은 **Redis Pub/Sub**를 통해 구현합니다.

```mermaid
graph TB
    subgraph "Client"
        FE[Frontend]
    end

    subgraph "apps/gateway/"
        GW[API Gateway :8000]
    end

    subgraph "apps/workflow-engine/"
        CW[Celery Worker]
    end

    subgraph "apps/log-system/"
        LS[Log System :8002]
    end

    subgraph "apps/shared/"
        DB[(Database Models)]
        SC[Schemas]
        CE[Celery Config]
    end

    subgraph "Infrastructure"
        RD[(Redis)]
        PG[(PostgreSQL)]
    end

    FE -->|HTTP| GW
    GW -->|"1. Celery Task"| CW
    CW -->|"2. Redis Pub/Sub"| GW
    GW -->|"3. SSE Stream"| FE

    CW -->|Celery Task| LS

    GW --> DB
    CW --> DB
    LS --> DB

    GW --> RD
    CW --> RD

    DB --> PG
```

---

## 아키텍처: Celery + Redis Pub/Sub

### 통신 흐름

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Redis
    participant Worker as Workflow Worker
    participant LogSystem as Log System

    Client->>Gateway: POST /run/{slug}
    Gateway->>Redis: Celery Task 발행
    Gateway->>Client: SSE Connection 시작
    Gateway->>Redis: SUBSCRIBE run:{run_id}

    Redis->>Worker: Task 수신
    Worker->>Worker: 워크플로우 실행

    loop 각 노드 실행
        Worker->>Redis: PUBLISH run:{run_id} (node_start)
        Redis->>Gateway: 이벤트 수신
        Gateway->>Client: SSE event: node_start

        Worker->>Redis: Celery Task (로그 저장)
        Redis->>LogSystem: 로그 저장

        Worker->>Redis: PUBLISH run:{run_id} (node_finish)
        Redis->>Gateway: 이벤트 수신
        Gateway->>Client: SSE event: node_finish
    end

    Worker->>Redis: PUBLISH run:{run_id} (workflow_finish)
    Redis->>Gateway: 이벤트 수신
    Gateway->>Client: SSE event: workflow_finish
    Gateway->>Redis: UNSUBSCRIBE run:{run_id}
```

### 장점

1. **단순한 아키텍처**: HTTP 서버 간 통신 제거, 서비스 간 결합도 감소
2. **확장성**: Celery Worker만 수평 확장하면 처리량 증가
3. **장애 격리**: Worker 장애가 Gateway에 영향 없음
4. **실시간 스트리밍**: Redis Pub/Sub로 지연 없는 이벤트 전달

---

## 현재 모놀리스 구조 분석

### 디렉토리 구조

```
apps/server/
├── main.py                 # FastAPI 앱 진입점
├── api/                    # API 라우터 (16개 엔드포인트)
│   └── v1/endpoints/
│       ├── workflow.py     # 워크플로우 CRUD
│       ├── run.py          # 워크플로우 실행
│       ├── auth.py         # 인증
│       ├── app.py          # 앱 관리
│       ├── deployment.py   # 배포 관리
│       ├── llm.py          # LLM 설정
│       ├── knowledge.py    # 지식베이스
│       ├── rag.py          # RAG 검색
│       └── ...
├── services/               # 비즈니스 로직
│   ├── deployment_service.py
│   ├── workflow_service.py
│   ├── llm_service.py
│   └── ...
├── workflow/               # 워크플로우 엔진 핵심
│   ├── core/
│   │   ├── workflow_engine.py    # 워크플로우 실행 엔진
│   │   ├── workflow_logger.py    # 로깅 유틸리티
│   │   └── log_worker_pool.py    # 로그 워커 풀
│   └── nodes/              # 노드 구현체들
├── db/                     # 데이터베이스
│   ├── models/             # SQLAlchemy 모델
│   ├── session.py          # DB 연결
│   └── seed.py             # 시드 데이터
└── schemas/                # Pydantic 스키마
```

### 책임 분리 분석

| 기능 영역       | 현재 위치                             | 분리 대상 서비스                |
| --------------- | ------------------------------------- | ------------------------------- |
| API 라우팅/인증 | `api/`, `auth/`                       | Gateway                         |
| 워크플로우 CRUD | `api/v1/endpoints/workflow.py`        | Gateway                         |
| 워크플로우 실행 | `workflow/core/workflow_engine.py`    | Workflow Engine (Celery Worker) |
| 배포 실행       | `services/deployment_service.py`      | Gateway -> Celery Task          |
| 로그 기록       | `workflow/core/log_worker_pool.py`    | Log System (Celery Task)        |
| 로그 조회       | `api/v1/endpoints/workflow.py` (일부) | Gateway (DB 직접 조회)          |
| DB 모델/스키마  | `db/`, `schemas/`                     | Shared                          |

---

## 단계별 마이그레이션 계획

### Phase 1: 기반 구축 (1-2일)

#### 1.1 공유 패키지 구조 생성

| 작업 | 상세                                          |
| ---- | --------------------------------------------- |
| 목표 | `apps/shared/` 패키지 기본 구조 생성          |
| 파일 | `apps/shared/__init__.py`, 기본 디렉토리 구조 |

디렉토리 구조:

```
apps/shared/
├── __init__.py
├── db/
│   ├── __init__.py
│   ├── base.py           # SQLAlchemy Base
│   ├── session.py        # DB 연결 설정
│   └── models/
│       ├── __init__.py
│       ├── user.py
│       ├── app.py
│       ├── workflow.py
│       ├── workflow_run.py
│       └── ...
├── schemas/
│   ├── __init__.py
│   ├── workflow.py
│   ├── deployment.py
│   └── ...
├── celery_app/
│   ├── __init__.py
│   ├── config.py         # Celery 설정
│   └── tasks/
│       ├── __init__.py
│       ├── workflow.py   # 워크플로 실행 태스크
│       └── log.py        # 로그 저장 태스크
├── redis/
│   ├── __init__.py
│   └── pubsub.py         # Redis Pub/Sub 유틸리티
└── utils/
    ├── __init__.py
    └── common.py
```

#### 1.2 기존 코드를 shared로 이동

| 작업    | 현재 위치                   | 이동 위치                   |
| ------- | --------------------------- | --------------------------- |
| DB 모델 | `apps/server/db/models/`    | `apps/shared/db/models/`    |
| DB 세션 | `apps/server/db/session.py` | `apps/shared/db/session.py` |
| 스키마  | `apps/server/schemas/`      | `apps/shared/schemas/`      |

---

### Phase 2: Redis 및 Celery 설정 (1일)

#### 2.1 Docker Compose에 Redis 추가

```yaml
# docker-compose.yml 수정
services:
  redis:
    image: redis:7-alpine
    container_name: moduly-dev-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  redis_data:
```

#### 2.2 Celery 설정 구현

```python
# apps/shared/celery_app/config.py
from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "moduly",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10분 타임아웃
    task_routes={
        "workflow.*": {"queue": "workflow"},
        "logs.*": {"queue": "logs"},
    },
)
```

#### 2.3 Redis Pub/Sub 유틸리티

```python
# apps/shared/redis/pubsub.py
import redis
import json
import os
from typing import AsyncGenerator, Any

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

def get_redis_client():
    return redis.from_url(REDIS_URL)

def publish_event(channel: str, event_type: str, data: dict):
    """이벤트 발행 (Worker에서 사용)"""
    client = get_redis_client()
    message = json.dumps({"type": event_type, "data": data})
    client.publish(channel, message)

async def subscribe_events(channel: str) -> AsyncGenerator[dict, None]:
    """이벤트 구독 (Gateway에서 SSE 스트리밍용)"""
    client = get_redis_client()
    pubsub = client.pubsub()
    pubsub.subscribe(channel)

    try:
        for message in pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                yield event

                # workflow_finish 또는 error 이벤트면 종료
                if event["type"] in ("workflow_finish", "error"):
                    break
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()
```

---

### Phase 3: Log System 서비스 구현 (2일)

> [!IMPORTANT]
> Log System은 가장 독립적인 서비스이므로 먼저 분리합니다.

#### 3.1 Log System 기본 구조

```
apps/log-system/
├── __init__.py
├── main.py               # FastAPI 앱 (로그 조회 API용)
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       └── endpoints/
│           ├── __init__.py
│           ├── logs.py       # 로그 조회 API
│           └── health.py
├── worker.py             # Celery Worker 진입점
├── tasks/
│   ├── __init__.py
│   └── log_tasks.py      # 로그 저장 태스크
└── requirements.txt
```

#### 3.2 로그 저장 Celery 태스크

```python
# apps/log-system/tasks/log_tasks.py
from apps.shared.celery_app.config import celery_app
from apps.shared.db.session import SessionLocal

@celery_app.task(name="logs.create_workflow_run")
def create_workflow_run_log(data: dict):
    """워크플로우 실행 로그 생성"""
    db = SessionLocal()
    try:
        # WorkflowLoggerDBOps.create_run_log 로직 사용
        from apps.shared.db.models.workflow_run import WorkflowRun
        run = WorkflowRun(**data)
        db.add(run)
        db.commit()
    finally:
        db.close()

@celery_app.task(name="logs.update_workflow_run")
def update_workflow_run_log(run_id: str, data: dict):
    """워크플로우 실행 로그 업데이트"""
    db = SessionLocal()
    try:
        # 업데이트 로직
        pass
    finally:
        db.close()

@celery_app.task(name="logs.create_node_run")
def create_node_run_log(data: dict):
    """노드 실행 로그 생성"""
    db = SessionLocal()
    try:
        from apps.shared.db.models.workflow_run import WorkflowNodeRun
        node_run = WorkflowNodeRun(**data)
        db.add(node_run)
        db.commit()
    finally:
        db.close()

@celery_app.task(name="logs.update_node_run")
def update_node_run_log(run_id: str, node_id: str, data: dict):
    """노드 실행 로그 업데이트"""
    db = SessionLocal()
    try:
        # 업데이트 로직
        pass
    finally:
        db.close()
```

#### 3.3 기존 LogWorkerPool을 Celery 태스크로 전환

```python
# apps/shared/utils/log_helper.py
from apps.shared.celery_app.config import celery_app

def log_workflow_run_start(data: dict):
    """워크플로우 실행 시작 로그 (비동기)"""
    celery_app.send_task("logs.create_workflow_run", args=[data])

def log_workflow_run_finish(run_id: str, data: dict):
    """워크플로우 실행 완료 로그 (비동기)"""
    celery_app.send_task("logs.update_workflow_run", args=[run_id, data])

def log_node_run_start(data: dict):
    """노드 실행 시작 로그 (비동기)"""
    celery_app.send_task("logs.create_node_run", args=[data])

def log_node_run_finish(run_id: str, node_id: str, data: dict):
    """노드 실행 완료 로그 (비동기)"""
    celery_app.send_task("logs.update_node_run", args=[run_id, node_id, data])
```

---

### Phase 4: Workflow Engine 서비스 구현 (3일)

#### 4.1 Workflow Engine 기본 구조 (HTTP 서버 없음)

```
apps/workflow-engine/
├── __init__.py
├── worker.py                 # Celery Worker 진입점
├── core/
│   ├── __init__.py
│   ├── engine.py             # WorkflowEngine 클래스 (수정)
│   ├── node_factory.py
│   └── utils.py
├── nodes/                    # 노드 구현체들
│   ├── __init__.py
│   ├── base.py
│   ├── start_node.py
│   ├── llm_node.py
│   └── ...
├── tasks/
│   ├── __init__.py
│   └── workflow_tasks.py     # 워크플로우 실행 태스크
└── requirements.txt
```

#### 4.2 워크플로우 실행 Celery 태스크

```python
# apps/workflow-engine/tasks/workflow_tasks.py
from apps.shared.celery_app.config import celery_app
from apps.shared.redis.pubsub import publish_event
from apps.shared.db.session import SessionLocal
from apps.workflow_engine.core.engine import WorkflowEngine

@celery_app.task(
    name="workflow.execute",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def execute_workflow(
    self,
    run_id: str,
    workflow_id: str,
    graph_data: dict,
    user_input: dict,
    execution_context: dict
):
    """
    워크플로우 실행 태스크

    실행 중 Redis Pub/Sub을 통해 실시간 이벤트 발행
    """
    channel = f"run:{run_id}"
    db = SessionLocal()

    try:
        engine = WorkflowEngine(
            graph=graph_data,
            user_input=user_input,
            db=db,
            workflow_id=workflow_id,
            run_id=run_id,
            event_publisher=lambda event_type, data: publish_event(channel, event_type, data),
            **execution_context
        )

        result = engine.execute_with_events()

        # 완료 이벤트 발행
        publish_event(channel, "workflow_finish", {
            "run_id": run_id,
            "outputs": result.get("outputs", {}),
            "status": "completed"
        })

        return result

    except Exception as e:
        # 에러 이벤트 발행
        publish_event(channel, "error", {
            "run_id": run_id,
            "error": str(e)
        })
        raise
    finally:
        db.close()
```

#### 4.3 WorkflowEngine 수정 (이벤트 발행 콜백 추가)

```python
# apps/workflow-engine/core/engine.py
class WorkflowEngine:
    def __init__(
        self,
        graph,
        user_input,
        db,
        workflow_id,
        run_id,
        event_publisher=None,  # 이벤트 발행 콜백
        **kwargs
    ):
        self.event_publisher = event_publisher
        # ... 기존 초기화 코드

    def _publish_event(self, event_type: str, data: dict):
        """이벤트 발행 (설정된 경우에만)"""
        if self.event_publisher:
            self.event_publisher(event_type, data)

    def execute_with_events(self):
        """이벤트를 발행하면서 실행"""
        # 기존 execute_deployed와 유사하지만
        # 각 노드 실행 시 이벤트 발행

        for node_id in execution_order:
            self._publish_event("node_start", {
                "node_id": node_id,
                "node_type": node_type
            })

            result = self._execute_node(node_id)

            self._publish_event("node_finish", {
                "node_id": node_id,
                "outputs": result
            })

        return final_result
```

---

### Phase 5: Gateway 서비스 구현 (2일)

#### 5.1 Gateway 기본 구조

```
apps/gateway/
├── __init__.py
├── main.py
├── api/
│   └── v1/
│       └── endpoints/
│           ├── auth.py           # 인증
│           ├── apps.py           # 앱 CRUD
│           ├── workflows.py      # 워크플로우 CRUD
│           ├── deployments.py    # 배포 관리
│           ├── run.py            # 실행 (Celery + SSE)
│           ├── llm.py            # LLM 설정
│           ├── knowledge.py      # 지식베이스
│           ├── rag.py            # RAG
│           ├── connectors.py     # 커넥터
│           ├── webhook.py        # 웹훅
│           └── health.py
├── services/
│   ├── __init__.py
│   ├── app_service.py
│   ├── workflow_service.py
│   └── deployment_service.py    # Celery 태스크 호출
├── middleware/
│   ├── __init__.py
│   └── auth.py
└── requirements.txt
```

#### 5.2 워크플로우 실행 엔드포인트 (SSE 스트리밍)

```python
# apps/gateway/api/v1/endpoints/run.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from apps.shared.celery_app.config import celery_app
from apps.shared.redis.pubsub import subscribe_events
import uuid
import json

router = APIRouter()

@router.post("/run/{url_slug}")
async def run_workflow(url_slug: str, request_body: dict, db: Session = Depends(get_db)):
    """
    배포된 워크플로우 실행 (SSE 스트리밍)

    1. Celery 태스크 발행
    2. Redis Pub/Sub 구독
    3. SSE로 이벤트 스트리밍
    """
    # 1. 배포 정보 조회
    deployment = get_deployment_by_slug(db, url_slug)

    # 2. 실행 ID 생성
    run_id = str(uuid.uuid4())

    # 3. Celery 태스크 발행
    celery_app.send_task(
        "workflow.execute",
        args=[
            run_id,
            str(deployment.workflow_id),
            deployment.graph_snapshot,
            request_body.get("inputs", {}),
            {"user_id": str(deployment.user_id), "is_deployed": True}
        ],
        queue="workflow"
    )

    # 4. SSE 스트리밍 응답
    async def event_stream():
        channel = f"run:{run_id}"
        async for event in subscribe_events(channel):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.post("/run-async/{url_slug}")
async def run_workflow_async(url_slug: str, request_body: dict, db: Session = Depends(get_db)):
    """
    비동기 워크플로우 실행 (태스크 ID 반환)

    스트리밍 불필요 시 사용
    """
    deployment = get_deployment_by_slug(db, url_slug)
    run_id = str(uuid.uuid4())

    task = celery_app.send_task(
        "workflow.execute",
        args=[run_id, str(deployment.workflow_id), ...],
        queue="workflow"
    )

    return {
        "run_id": run_id,
        "task_id": task.id,
        "status": "pending"
    }

@router.get("/run-status/{run_id}")
async def get_run_status(run_id: str, db: Session = Depends(get_db)):
    """실행 상태 조회"""
    from apps.shared.db.models.workflow_run import WorkflowRun
    run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404)
    return {"run_id": run_id, "status": run.status, "outputs": run.outputs}
```

---

### Phase 6: 통합 테스트 및 마이그레이션 (2일)

#### 6.1 Docker Compose 통합 구성

```yaml
# docker-compose.yml
services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: moduly-dev-postgres
    environment:
      POSTGRES_DB: moduly_local
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: moduly-dev-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  gateway:
    build:
      context: .
      dockerfile: docker/gateway/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://admin:admin123@postgres:5432/moduly_local
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis

  workflow-worker:
    build:
      context: .
      dockerfile: docker/workflow-engine/Dockerfile
    command: celery -A worker worker -Q workflow --loglevel=info
    environment:
      - DATABASE_URL=postgresql://admin:admin123@postgres:5432/moduly_local
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      - postgres

  log-system:
    build:
      context: .
      dockerfile: docker/log-system/Dockerfile
    ports:
      - "8002:8002"
    environment:
      - DATABASE_URL=postgresql://admin:admin123@postgres:5432/moduly_local
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis

  log-worker:
    build:
      context: .
      dockerfile: docker/log-system/Dockerfile
    command: celery -A worker worker -Q logs --loglevel=info
    environment:
      - DATABASE_URL=postgresql://admin:admin123@postgres:5432/moduly_local
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
      - postgres

volumes:
  postgres_data:
  redis_data:
```

#### 6.2 통합 테스트 시나리오

| 테스트          | 설명                                  | 검증 포인트                    |
| --------------- | ------------------------------------- | ------------------------------ |
| 워크플로우 CRUD | Gateway를 통한 워크플로우 생성/조회   | DB 저장 확인                   |
| SSE 스트리밍    | 워크플로우 실행 시 실시간 이벤트 수신 | node_start, node_finish 이벤트 |
| 비동기 실행     | Celery 태스크 실행                    | 태스크 ID 반환, 상태 조회      |
| 로그 기록       | 실행 로그 저장                        | Log Worker 처리 확인           |
| 장애 복구       | Worker 재시작 시 태스크 재처리        | Redis 큐 상태 유지             |

---

### Phase 7: 기존 모놀리스 제거 및 정리 (1일)

#### 7.1 Import 경로 전환

모든 서비스에서 shared 패키지 사용:

```python
# Before
from db.models.workflow import Workflow
from schemas.workflow import WorkflowCreate

# After
from apps.shared.db.models.workflow import Workflow
from apps.shared.schemas.workflow import WorkflowCreate
```

#### 7.2 기존 apps/server/ 정리

> [!CAUTION]
> 모든 테스트 통과 확인 후 진행

- `apps/server/` 디렉토리 제거 또는 아카이브
- 프로젝트 루트의 스크립트 업데이트 (`start.sh`, `test.sh`)

---

## 상세 단계 요약

| 단계        | 작업 내용                                 | 예상 소요 |
| ----------- | ----------------------------------------- | --------- |
| **Phase 1** | 공유 패키지 기본 구조, DB/스키마 이동     | 1-2일     |
| **Phase 2** | Redis 추가, Celery 설정, Pub/Sub 유틸리티 | 1일       |
| **Phase 3** | Log System 서비스 완성                    | 2일       |
| **Phase 4** | Workflow Engine (Celery Worker) 완성      | 3일       |
| **Phase 5** | Gateway 서비스 완성                       | 2일       |
| **Phase 6** | Docker 통합, 통합 테스트                  | 2일       |
| **Phase 7** | 정리 및 마이그레이션 완료                 | 1일       |

**총 예상 소요**: 12-14일

---

## 검증 계획

### 자동화 테스트

```bash
# 각 서비스 단위 테스트
pytest apps/gateway/tests/
pytest apps/workflow-engine/tests/
pytest apps/log-system/tests/

# 통합 테스트
pytest tests/integration/
```

### 수동 검증

1. Docker Compose로 전체 서비스 기동
2. Postman/curl로 주요 API 테스트
3. SSE 스트리밍 테스트 (EventSource 클라이언트)
4. 프론트엔드 연동 테스트
5. 부하 테스트 (Locust)

---

## 롤백 전략

각 Phase 완료 시 Git 태그 생성:

```bash
git tag -a phase-1-complete -m "Phase 1: Shared package structure"
git tag -a phase-2-complete -m "Phase 2: Redis, Celery and Pub/Sub setup"
# ...
```

문제 발생 시 해당 Phase 이전 태그로 롤백 가능.
