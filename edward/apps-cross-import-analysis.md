# Apps 디렉토리 상호 Import 분석

분석 대상: `gateway`, `log-system`, `workflow-engine`

> [!TIP] > **해결됨**: 아래 문제들은 2026-01-12에 해결되었습니다.

---

## 분석 결과 요약 (해결 후)

| 앱              | 직접 Import | 간접 참조                      |
| --------------- | ----------- | ------------------------------ |
| gateway         | 없음        | 없음                           |
| log-system      | 없음        | 없음 (프로젝트 루트 .env 참조) |
| workflow-engine | 없음        | log-system HTTP API 호출       |

---

## 상세 분석

### 1. gateway

다른 앱을 import하거나 참조하는 코드가 **없음**.

- `log-system` 관련 참조: 없음
- `workflow-engine` 관련 참조: 없음

---

### 2. log-system

#### .env 파일 참조 (해결됨)

**파일**: `main.py`

```python
# Try loading from local, then project root
LOCAL_ENV_PATH = BASE_DIR / ".env"
ROOT_ENV_PATH = APPS_DIR.parent / ".env"
```

- 로컬 .env 우선, 없으면 프로젝트 루트 .env 참조
- gateway 의존성 제거됨

---

### 3. workflow-engine

#### gateway 참조 (해결됨)

**파일**: `main.py`

```python
# shared 패키지 경로만 추가
sys.path.insert(0, str(APPS_DIR / "shared"))

# .env 로드 (로컬 또는 프로젝트 루트)
LOCAL_ENV_PATH = Path(__file__).parent / ".env"
ROOT_ENV_PATH = APPS_DIR.parent / ".env"
```

- gateway sys.path 제거됨 (실제로 사용하지 않았음)
- .env 로딩: 로컬 우선, 프로젝트 루트 순서

#### log-system HTTP 통신

**파일**: `workflow/core/workflow_logger.py`, `workflow/core/log_worker_pool.py`

```python
log_system_url = os.getenv("LOG_SYSTEM_URL", "http://localhost:8002").rstrip(...)
```

- 직접적인 Python import가 아닌 HTTP API 호출 방식
- `LOG_SYSTEM_URL` 환경변수를 통해 log-system 서비스에 로그 전송

---

## 의존성 다이어그램 (해결 후)

```
gateway (독립)

workflow-engine -----> log-system
                HTTP API 호출

log-system (독립)
```

---

## 결론

1. **gateway 의존성 제거됨**: workflow-engine이 gateway를 sys.path에 추가하던 불필요한 코드 삭제
2. **.env 공유 방식 개선**: 각 앱이 로컬 .env 또는 프로젝트 루트 .env를 참조
3. **HTTP 통신**: workflow-engine → log-system 간 통신은 HTTP API를 사용하여 느슨한 결합 유지
