# 개발 및 테스트 스크립트 사용 가이드

이 문서는 프로젝트의 개발 환경 실행 및 테스트를 위해 제공되는 스크립트의 사용법을 안내합니다.

## 개발 환경 실행 스크립트 (dev.sh)

`scripts/dev.sh`는 로컬 개발 환경에 필요한 모든 서비스를 실행합니다.

### 실행 방법

프로젝트 루트에서 다음 명령어를 실행합니다.

```bash
./scripts/dev.sh
```

### 기능

이 스크립트는 다음 구성 요소를 순차적으로 실행합니다.

1.  **인프라 (Docker Compose)**: PostgreSQL 및 Redis 컨테이너를 시작합니다.
2.  **Celery Workers**:
    - Log System Worker (큐: `log`)
    - Workflow Engine Worker (큐: `workflow`)
3.  **Gateway API 서버**: FastAPI 기반의 API 서버를 실행합니다. (포트: 8000)
4.  **Next.js 클라이언트**: `apps/client` 디렉토리가 존재하는 경우 프론트엔드 서버를 실행합니다.

### 종료 방법

터미널에서 `Ctrl+C`를 입력하면 실행 중인 모든 백그라운드 프로세스와 Docker 컨테이너가 안전하게 종료됩니다.

---

## 통합 테스트 실행 스크립트 (test.sh)

`scripts/test.sh`는 각 마이크로서비스의 테스트를 통합 실행합니다.

### 실행 방법

프로젝트 루트에서 다음 명령어를 실행합니다.

```bash
./scripts/test.sh
```

### 기능

이 스크립트는 다음 서비스들의 테스트를 순차적으로 수행합니다.

1.  **Gateway Service**: `apps/gateway/tests` 내의 테스트를 실행합니다.
2.  **Workflow Engine Service**: `apps/workflow_engine/tests` 내의 테스트를 실행합니다.
3.  **Client App Build**: `apps/client` 디렉토리에서 `npm run build`를 실행하여 빌드 오류를 확인합니다.

각 서비스의 가상환경을 활성화하고 `pytest`를 실행하며, 모든 테스트가 종료되면 결과를 요약하여 출력합니다.
