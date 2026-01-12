# Apps 디렉토리 상호 Import 분석

분석 대상: `gateway`, `log-system`, `workflow-engine`

---

## 분석 결과 요약

| 앱              | 직접 Import           | 간접 참조                |
| --------------- | --------------------- | ------------------------ |
| gateway         | 없음                  | 없음                     |
| log-system      | 없음                  | gateway `.env` 파일 참조 |
| workflow-engine | gateway sys.path 추가 | log-system HTTP API 호출 |

---

## 상세 분석

### 1. gateway

다른 앱을 import하거나 참조하는 코드가 **없음**.

- `log-system` 관련 참조: 없음
- `workflow-engine` 관련 참조: 없음

---

### 2. log-system

#### gateway `.env` 파일 참조

**파일**: `main.py`

```python
# Try loading shared env from gateway if not in own dir
GATEWAY_ENV_PATH = BASE_DIR / "../gateway/.env"
```

- 환경 변수 공유 목적으로 gateway의 `.env` 파일 경로를 참조
- 코드 로직의 Python import는 아님

---

### 3. workflow-engine

#### gateway 참조

**파일**: `main.py`

```python
sys.path.insert(0, str(APPS_DIR / "gateway"))  # services 등 참조용

# .env 로드 (gateway의 .env 공유) - 다른 모듈 임포트 전에 수행
env_path = APPS_DIR / "gateway" / ".env"
```

- `sys.path`에 gateway 경로를 추가하여 gateway의 모듈(`services` 등)을 import 가능하게 설정
- gateway의 `.env` 파일을 공유하여 환경 변수 로드

#### log-system HTTP 통신

**파일**: `workflow/core/workflow_logger.py`

```python
log_system_url = os.getenv("LOG_SYSTEM_URL", "http://localhost:8002").rstrip(...)
f"{log_system_url}/logs/runs", json=payload, timeout=5.0
```

**파일**: `workflow/core/log_worker_pool.py`

```python
log_system_url = os.getenv("LOG_SYSTEM_URL", "http://localhost:8002").rstrip(...)
self._process_task_http(task, log_system_url, JSONEncoder)
```

- 직접적인 Python import가 아닌 HTTP API 호출 방식
- `LOG_SYSTEM_URL` 환경변수를 통해 log-system 서비스에 로그 전송

---

## 의존성 다이어그램

```
gateway (독립)
    ^
    |
    +-- sys.path, .env 참조
    |
workflow-engine -----> log-system
                HTTP API 호출

log-system
    |
    +-- gateway .env 참조 (환경변수만)
```

---

## 주의사항

1. **workflow-engine의 gateway 의존성**: `sys.path.insert`로 gateway 경로를 추가하여 gateway의 `services` 모듈을 직접 import할 수 있는 상태. 이는 강한 결합(tight coupling)을 의미하며, 독립 배포 시 문제가 될 수 있음.

2. **환경변수 공유**: log-system과 workflow-engine 모두 gateway의 `.env` 파일을 참조. 중앙화된 설정 관리가 필요할 수 있음.

3. **HTTP 통신**: workflow-engine → log-system 간 통신은 HTTP API를 사용하여 느슨한 결합(loose coupling) 유지.
