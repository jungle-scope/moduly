# Moduly에 기여하기

Moduly에 관심을 가져주셔서 감사합니다! <br/>버그 수정, 기능 추가, 문서 개선 등 어떤 형태의 기여도 환영합니다.

## 목차

- [행동 강령](#행동-강령)
- [프로젝트 구조](#프로젝트-구조)
- [개발 환경 설정](#개발-환경-설정)
- [기여 방법](#기여-방법)
- [PR 가이드라인](#pr-가이드라인)
- [코드 스타일](#코드-스타일)

## 행동 강령

이 프로젝트에 참여하는 모든 분들은 [행동 강령](./CODE_OF_CONDUCT.md)을 준수해 주세요. 서로를 존중하고 건설적인 피드백을 주고받아 주세요.

## 프로젝트 구조

Moduly는 모노레포 구조로 구성되어 있습니다.

```
moduly/
├── apps/
│   ├── client/          # Next.js 프론트엔드
│   ├── gateway/         # FastAPI 게이트웨이
│   └── workflow-engine/ # Celery 워크플로우 엔진
├── docker/              # Docker 설정 파일
├── infra/               # Terraform, Helm 차트
└── tests/               # 통합 테스트
```

## 개발 환경 설정

### 필수 요구사항

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- Git

### 설치

```bash
# 저장소 클론
git clone https://github.com/jungle-scope/moduly.git
cd moduly

# 환경 변수 설정
cp .env.example .env

# Docker 서비스 실행
docker-compose up -d --build

# 의존성 설치 및 개발 서버 시작
make all
```

## 기여 방법

### 1. Issue 확인

작업을 시작하기 전에 [Issues](https://github.com/jungle-scope/moduly/issues)에서 관련 이슈가 있는지 확인해주세요. 없다면 새 이슈를 생성해 주세요.

### 2. Fork & Branch

```bash
# 저장소 Fork 후 클론
git clone https://github.com/YOUR_USERNAME/moduly.git

# 브랜치 생성
git checkout -b feature/your-feature-name
```

### 브랜치 네이밍

- `feature/` - 새로운 기능
- `fix/` - 버그 수정
- `docs/` - 문서 수정
- `refactor/` - 리팩토링

### 3. 변경사항 커밋

```bash
git add .
git commit -m "feat: 새로운 기능 추가"
```

#### 커밋 메시지 규칙

- `feat:` 새로운 기능
- `fix:` 버그 수정
- `docs:` 문서 수정
- `style:` 코드 포맷팅
- `refactor:` 코드 리팩토링
- `test:` 테스트 추가/수정
- `chore:` 빌드, 설정 변경

### 4. PR 제출

```bash
git push origin feature/your-feature-name
```

GitHub에서 Pull Request를 생성해주세요.

## PR 가이드라인

### 필수 사항

- 관련 Issue 링크
- 변경사항에 대한 명확한 설명
- 테스트 통과
- 코드 스타일 준수

### PR 크기

- 하나의 PR은 하나의 기능/수정에 집중해주세요
- 큰 변경사항은 여러 개의 작은 PR로 나눠주세요

### 리뷰 프로세스

1. PR 제출 후 리뷰어가 배정됩니다
2. 피드백이 있으면 14일 내에 수정해주세요
3. 승인 후 `develop` 브랜치에 머지됩니다

## 코드 스타일

### Frontend (TypeScript)

- ESLint, Prettier 설정을 따라주세요
- `pnpm lint`로 검사

### Backend (Python)

- Black, isort, Ruff 포맷터 사용
- `make lint`로 검사

### 테스트

```bash
# 전체 테스트
make test

# Frontend 테스트
cd apps/client && pnpm test

# Backend 테스트
cd apps/workflow-engine && pytest
```

---

질문이 있으시면 [Q&A](https://github.com/jungle-scope/moduly/discussions/categories/q-a)에 남겨주세요!
