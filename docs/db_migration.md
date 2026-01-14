# 데이터베이스 마이그레이션 가이드 (Alembic)

이 문서는 Alembic을 사용하여 데이터베이스 스키마를 관리하고 마이그레이션하는 방법을 안내합니다. 모든 명령어는 프로젝트 루트(`moduly`)에서 실행해야 합니다.

## 사전 준비

Alembic 명령어를 실행하기 전에 로컬 데이터베이스(PostgreSQL)가 실행 중이어야 합니다.
또한, Python 가상환경이 활성화되어 있어야 합니다.

```bash
# 프로젝트 루트 이동
cd /Users/antinori/Desktop/nmm/moduly

# 가상환경 활성화 (Gateway 서비스 기준)
source apps/gateway/.venv/bin/activate
```

## 주요 명령어

### 1. 현재 상태 확인

현재 데이터베이스에 적용된 마이그레이션 버전을 확인합니다.

```bash
alembic -c apps/shared/alembic.ini current
```

### 2. 마이그레이션 히스토리 확인

전체 마이그레이션 기록을 확인합니다.

```bash
alembic -c apps/shared/alembic.ini history
```

### 3. 새 마이그레이션 생성 (Autogenerate)

모델 변경 사항을 감지하여 자동으로 마이그레이션 파일을 생성합니다.

```bash
alembic -c apps/shared/alembic.ini revision --autogenerate -m "변경 사항에 대한 설명"
```

**주의사항**: 자동 생성된 파일은 반드시 내용을 검토해야 합니다. `apps/shared/migrations/versions` 디렉토리에 생성됩니다.

### 4. 마이그레이션 적용 (Upgrade)

대기 중인 마이그레이션을 데이터베이스에 적용하여 최신 상태로 만듭니다.

```bash
alembic -c apps/shared/alembic.ini upgrade head
```

### 5. 마이그레이션 취소 (Downgrade)

직전 단계로 되돌립니다.

```bash
alembic -c apps/shared/alembic.ini downgrade -1
```

## 문제 해결 (Troubleshooting)

### DB 연결 오류

데이터베이스 컨테이너가 실행 중인지 확인하세요.

```bash
docker ps
```

### Alembic 설정 파일 위치

Alembic 설정은 `apps/shared/alembic.ini`에 정의되어 있습니다.
