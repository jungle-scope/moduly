# 데이터베이스 마이그레이션 가이드 (Alembic)

이 문서는 Alembic을 사용하여 데이터베이스 스키마를 관리하고 마이그레이션하는 방법을 안내합니다. 모든 명령어는 **프로젝트 루트 디렉토리**에서 실행해야 합니다.

## 1. 사전 준비

### 데이터베이스 실행

Alembic 명령어를 실행하기 전에 로컬 데이터베이스(PostgreSQL)가 실행 중이어야 합니다. `dev.sh`를 실행 중이거나, 별도로 데이터베이스 컨테이너를 띄워야 합니다.

```bash
docker compose up -d postgres
```

### 가상환경 활성화

Alembic 라이브러리와 DB 드라이버를 사용하기 위해 Python 가상환경을 활성화해야 합니다. `setup.sh`를 통해 설정된 `apps/gateway`의 가상환경을 사용할 수 있습니다.

```bash
# 가상환경 활성화
source apps/gateway/.venv/bin/activate
```

> **참고**: `apps/shared` 라이브러리가 설치되어 있어야 합니다. ( `setup.sh` 실행 시 자동 설치됨)

---

## 2. 주요 명령어

### 현재 버전 확인

현재 데이터베이스에 적용된 마이그레이션 리비전(Revision)을 확인합니다.

```bash
alembic -c apps/shared/alembic.ini current
```

### 마이그레이션 히스토리 확인

전체 마이그레이션 기록을 조회합니다.

```bash
alembic -c apps/shared/alembic.ini history
```

### 새 마이그레이션 생성 (Autogenerate)

SQLAlchemy 모델(`apps/shared/models`)의 변경 사항을 감지하여 자동으로 마이그레이션 파일을 생성합니다.

```bash
alembic -c apps/shared/alembic.ini revision --autogenerate -m "변경 사항 설명"
```

> **주의**: 생성된 파일은 `apps/shared/alembic/versions` 디렉토리에 저장됩니다. 반드시 내용을 열어 의도한 변경사항이 맞는지 검토해야 합니다.

### 마이그레이션 적용 (Upgrade)

대기 중인 마이그레이션을 데이터베이스에 적용하여 스키마를 최신 상태로 동기화합니다.

```bash
alembic -c apps/shared/alembic.ini upgrade head
```

### 마이그레이션 취소 (Downgrade)

직전 마이그레이션을 취소하고 이전 상태로 되돌립니다.

```bash
alembic -c apps/shared/alembic.ini downgrade -1
```

---

## 3. 문제 해결 (Troubleshooting)

### DB 연결 오류

- **원인**: 데이터베이스 컨테이너가 실행되지 않았거나, 접속 정보가 잘못되었습니다.
- **해결**:
  1. `docker ps` 명령어로 `postgres` 컨테이너 상태 확인.
  2. `.env` 파일에 DB 접속 정보(`DB_HOST`, `DB_PASSWORD` 등)가 올바르게 설정되어 있는지 확인. (기본값: `localhost:5432`, `admin`/`admin123`)

### Alembic 설정 파일 위치

- 설정 파일: `apps/shared/alembic.ini`
- 마이그레이션 스크립트 위치: `apps/shared/alembic/versions`
