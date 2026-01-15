# 개발 및 테스트 스크립트 사용 가이드

이 문서는 프로젝트의 개발 환경 설정, 실행, 테스트 및 정리를 위해 제공되는 스크립트의 사용법을 안내합니다. 모든 스크립트는 프로젝트 루트 디렉토리에서 실행해야 합니다.

## 1. 개발 환경 설정 (setup.sh)

프로젝트를 처음 시작하거나 의존성이 변경되었을 때 개발 환경을 자동으로 설정하는 스크립트입니다.

### 실행 방법

```bash
./scripts/setup.sh
```

### 기능

- **시스템 요구사항 확인**: Python3 및 npm 설치 여부를 확인합니다.
- **가상환경 생성**: 각 Python 서비스(`apps/gateway`, `apps/log_system`, `apps/workflow_engine`)에 대해 `.venv` 가상환경을 생성합니다.
- **공용 패키지 설치**: `apps/shared` 라이브러리를 각 서비스에 개발 모드(`-e`)로 설치합니다.
- **의존성 설치**: 각 서비스의 `requirements.txt` 또는 `pyproject.toml`에 명시된 의존성을 설치 및 업그레이드합니다.
- **Node.js 패키지 설치**: `apps/client` 디렉토리가 존재하는 경우 프론트엔드 의존성을 설치합니다.

---

## 2. 개발 환경 실행 (dev.sh)

로컬 개발에 필요한 모든 인프라와 서비스를 통합하여 실행합니다.

### 실행 방법

```bash
./scripts/dev.sh
```

### 기능

- **사전 점검**: 가상환경이 없으면 자동으로 `setup.sh`를 실행하여 환경을 설정합니다.
- **인프라 실행 (Docker Compose)**:
  - **PostgreSQL**: 메인 데이터베이스
  - **Redis**: 메시지 브로커 및 캐시
  - **pgAdmin**: DB 관리 도구 (브라우저에서 `http://localhost:5050` 접속)
- **Celery Workers**:
  - **Log System Worker**: 로그 처리 (Queue: `log`)
  - **Workflow Engine Worker**: 워크플로우 실행 (Queue: `workflow`)
- **API 서버 (Gateway)**: FastAPI 기반 Gateway 서버 실행 (Port: `8000`)
- **프론트엔드 (Client)**: Next.js 개발 서버 실행 (Port: `3000`)

### 접속 정보

- **API 문서**: `http://localhost:8000/docs`
- **프론트엔드**: `http://localhost:3000`
- **pgAdmin**: `http://localhost:5050`

### 종료 방법

터미널에서 `Ctrl+C`를 입력하면 모든 프로세스와 컨테이너가 안전하게 종료됩니다.

---

## 3. 통합 테스트 실행 (test.sh)

전체 마이크로서비스에 대한 테스트를 일괄 실행합니다.

### 실행 방법

```bash
./scripts/test.sh
```

### 기능

- **Gateway Service**: `apps/gateway/tests`의 pytest 실행
- **Workflow Engine**: `apps/workflow_engine/tests`의 pytest 실행
- **Client Build**: `apps/client`의 `npm run build`를 실행하여 빌드 오류 점검

테스트가 완료되면 각 항목의 성공/실패 여부를 요약하여 출력합니다.

---

## 4. 개발 환경 정리 (clean.sh)

개발 환경을 초기화하고 싶을 때 사용합니다. 생성된 가상환경, 설치된 라이브러리, 캐시 파일 등을 모두 삭제합니다.

### 주의사항

이 스크립트는 모든 `.venv` 폴더와 `node_modules`를 영구적으로 삭제하므로 실행 전 주의가 필요합니다. 실행 시 사용자 확인 절차를 거칩니다.

### 실행 방법

```bash
./scripts/clean.sh
```

### 기능

- **Python 캐시 삭제**: `__pycache__`, `.pytest_cache`, `.pyc` 파일 제거
- **가상환경 삭제**: 모든 서비스의 `.venv` 디렉토리 삭제
- **Node 모듈 삭제**: `apps/client/node_modules` 삭제
