# Moduly: Open-Source AI Workflow Builder

<p align="center">
  <img src="https://github.com/jungle-scope/moduly/raw/main/assets/hero-animation.gif" alt="Moduly Hero" width="800">
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/jungle-scope/moduly?style=for-the-badge" alt="license">
  <img src="https://img.shields.io/github/stars/jungle-scope/moduly?style=for-the-badge" alt="stars">
  <img src="https://img.shields.io/github/issues/jungle-scope/moduly?style=for-the-badge" alt="issues">
</p>

<p align="center">
  <strong>Moduly</strong>는 직관적인 드래그 앤 드랍 인터페이스를 통해 누구나 복잡한 AI 에이전트를 구축하고 배포할 수 있게 도와주는 오픈소스 도구입니다. 실시간 DB 동기화 기반의 RAG 엔진으로 '살아있는 데이터'를 가진 AI를 즉시 구현하세요.
</p>

<p align="center">
  <a href="https://moduly-ai.cloud"><strong>SaaS 체험하기</strong></a> | 
  <a href="#-빠른-시작"><strong>설치 가이드</strong></a> | 
  <a href="https://github.com/jungle-scope/moduly/issues"><strong>기능 제안</strong></a>
</p>

## Key Features

| 🔄 Real-time RAG | 🎨 Visual Flow Builder | 🚀 One-click Deploy |
| :--- | :--- | :--- |
| **실시간 데이터 동기화** <br> 외부 DB와 실시간 동기화되어 항상 최신 데이터를 유지하는 지식 베이스를 구축합니다. | **노드 기반 에디터** <br> 코딩 없이 드래그 앤 드랍으로 노드를 연결하여 AI 로직을 설계합니다. | **즉시 배포** <br> 클릭 한 번으로 워크플로우를 테스트하고 API 또는 웹앱으로 배포합니다. |

- **다양한 노드 타입** - LLM, HTTP API, Python 코드 실행, 파일/변수 추출, 반복(Loop), 조건(If) 분기 등
- **실시간 스트리밍** - LLM 노드 및 전체 워크플로우의 실행 결과를 실시간 스트리밍(SSE)으로 확인
- **안전한 코드 실행** - NSJail 및 자체 샌드박스 환경에서 격리된 Python 코드 실행 보장
- **간편한 로컬 환경** - Docker Compose 및 Makefile을 통한 원터치 개발 환경 구성


---

## Tech Stack

- **Frontend**: React, Next.js 14, ReactFlow, TailwindCSS
- **Backend**: Python 3.11+ (FastAPI / Starlette)
- **Engine**: AsyncIO 기반 자체 워크플로우 엔진 (Celery + Redis)
- **Infrastructure**: AWS (S3, EKS), PostgreSQL, Alembic, Redis
- **AI/LLM**: LangChain, OpenAI/Anthropic/Gemini SDK

## System Architecture

<img width="8192" height="2169" alt="Mermaid Chart - Create complex, visual diagrams with text -2026-01-19-082048" src="https://github.com/user-attachments/assets/a7c630f6-41a1-4aec-8294-a73e24d6d1a8" />

---

## 빠른 시작

Moduly는 **SaaS**, **셀프 호스팅 (Docker Compose)**, **셀프 호스팅 (Helm Chart)** 세 가지 방식을 지원합니다.

### 1. SaaS (Cloud)

별도의 설치 없이 바로 시작해보세요.

👉 [**Moduly Cloud 바로가기 (moduly-ai.cloud)**](https://moduly-ai.cloud)

### 2. 셀프 호스팅 (Docker Compose)

로컬 환경에서 실행하려면 Docker Compose를 사용하세요.

**사전 요구사항**
- Docker & Docker Compose

**설치 및 실행**

1. **저장소 클론 및 이동**
   ```bash
   git clone https://github.com/jungle-scope/moduly.git
   cd moduly/docker
   ```

2. **환경 변수 설정 (선택사항)**
   ```bash
   cp .env.example .env
   # .env 파일을 열어 필요한 설정을 수정할 수 있습니다.
   ```

3. **서비스 시작**
   ```bash
   docker-compose up -d
   ```

   > **참고**: 첫 실행 시 빌드와 DB 마이그레이션으로 3-5분 정도 소요될 수 있습니다.

4. **접속**
   - **웹앱**: `http://localhost`
   - **API 문서**: `http://localhost/api/docs`

### 3. 셀프 호스팅 (Helm Chart)

Kubernetes 클러스터 배포를 위한 Helm Chart를 제공합니다.

   ```bash
   # 설정 파일 생성
   helm show values ./infra/helm/moduly > values.yaml
   # (values.yaml 수정 후) 설치
   helm upgrade --install moduly ./infra/helm/moduly -f values.yaml
   ```

### 초기 설정 (API 키 및 모델)

1. 웹 인터페이스의 **설정(Settings)** 페이지로 이동합니다.
2. **OpenAI, Anthropic, Gemini** 등 사용할 AI 제공업체의 API 키를 등록합니다.
3. 사용할 모델(GPT-4, Claude 3.5 등)을 추가합니다.

이제 Moduly를 사용할 준비가 되었습니다!

---

## 상세 가이드 (Documentation)
이 섹션에는 프로젝트 기여 및 운영에 필요한 모든 상세 정보가 포함되어 있습니다. 별도의 위키 없이 이 가이드를 통해 모든 설정을 마칠 수 있습니다.

<details>
<summary><b>📚 노드 타입 가이드 (Node Types)</b></summary>
<br/>
Moduly는 다양한 목적에 맞는 노드들을 제공합니다.<br/>

* 시작 (Start): 워크플로우 진입점, 입력 변수 정의
* LLM: OpenAI, Anthropic 등 AI 모델 호출
* 지식/RAG (Knowledge): 실시간 동기화된 DB 데이터 검색
* HTTP 요청: 외부 REST API 연동 (GET/POST)
* 코드 (Code): Sandbox 환경에서 안전한 Python 스크립트 실행
* 조건/반복 (Logic): If-Else 분기 및 List 반복 처리
* 응답 (Answer): 최종 결과값 반환

</details>

<details>
<summary><b>🛠 개발자 가이드 (Development Guide)</b></summary>
<br/>
   
### 1. 로컬 개발 환경 (Makefile 사용 권장)
프로젝트 루트에서 Makefile을 이용해 전체 서비스를 쉽게 설정할 수 있습니다.
```bash
# 전체 서비스 설치 및 실행 (Gateway, Workflow Engine, Client)
make all
# 또는 개별 실행
make dev
```

## 2. 수동 설정 (Backend) ##
Moduly 백엔드는 Gateway와 Workflow Engine으로 나뉘어 있습니다.

**Gateway (API Server)**
```bash
cd apps/gateway
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Workflow Engine (Worker)**
```bash
cd apps/workflow_engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m celery -A tasks worker --loglevel=info
```

## 3. 데이터베이스 마이그레이션 ##
스키마 변경 시 apps/shared에서 Alembic을 사용합니다.
```bash
cd apps/shared
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## 4. 프론트엔드 (Next.js/ReactFlow)
```bash
cd apps/client
npm install
npm run dev
```

## 5. 환경 변수 설정 (.env)
배포 시 다음 핵심 변수들이 올바르게 설정되었는지 확인하세요.

- DATABASE_URL: PostgreSQL 데이터베이스 접속 정보
- REDIS_URL: Celery Task Queue 및 캐싱을 위한 Redis 주소
- OPENAI_API_KEY: LLM 노드 사용을 위한 기본 API 키
- S3_BUCKET_NAME: 파일 업로드 및 워크플로우 자산 저장을 위한 AWS S3 버킷

**Docker Compose 환경 최적화**
프로덕션 환경에서는 성능과 안정성을 위해 다음과 같은 설정을 권장합니다.
- docker-compose.yml에서 각 서비스의 deploy.resources 제한을 설정하세요.
- 데이터 유실 방지를 위해 PostgreSQL 볼륨 마운트 경로(./data/db)를 정기적으로 백업하세요.

**Kubernetes Helm Chart**
- `infra/helm/moduly/` 경로의 차트를 사용하여 대규모 클러스터에 배포할 수 있습니다.
- ingress: 외부 접속 도메인 및 TLS 인증서(Cert-manager 연동) 설정
- hpa: 트래픽 증가에 따른 자동 수평 확장 설정

</details>

<details> <summary><b>🌐 API 레퍼런스 (API Reference)</b></summary>
<br/>
Moduly는 외부 앱이나 서비스에서 워크플로우를 원격으로 제어할 수 있는 강력한 REST API를 제공합니다.<br/>
* GET /api/v1/workflows: 워크플로우 목록 조회
* POST /api/v1/run/{url_slug}: 워크플로우 실행
* GET /api/docs: Swagger UI
</details>

## 사용 방법

### 첫 워크플로우 만들기

1. http://localhost 접속
2. 새 워크플로우 생성
3. 사이드바에서 노드 추가:
   - **시작 노드** - 입력 변수와 함께 시작점 정의
   - **LLM 노드** - OpenAI 모델 호출
   - **HTTP 노드** - 외부 API 호출
   - **코드 노드** - 커스텀 Python 코드 실행
   - **응답 노드** - 워크플로우 출력 정의
4. 엣지를 드래그하여 노드 연결
5. "실행" 버튼으로 워크플로우 테스트
6. API, 웹앱 또는 위젯으로 배포

### 배포 옵션

**REST API**
```bash
curl -X POST http://localhost:8000/api/v1/run/{url_slug} \
  -H "Content-Type: application/json" \
  -d '{"input_variable": "value"}'
```

**웹앱**
생성된 UI와 함께 워크플로우의 공개 URL 공유

**위젯**
간단한 스크립트 태그로 어디든 워크플로우 임베드

### 테스트 실행

```bash
# 백엔드 테스트
cd apps/server
pytest

# 프론트엔드 테스트
cd apps/client
npm run test

# 린팅
cd apps/server
ruff check .

cd apps/client
npm run lint
```

## 기여하기

기여를 환영합니다! 

1. 저장소 포크(Fork)
2. 기능 브랜치 생성 (git checkout -b feature/AmazingFeature)
3. 변경사항 커밋 (git commit -m 'Add AmazingFeature')
4. 브랜치에 푸시 (git push origin feature/AmazingFeature)
5. Pull Request 열기

---

Moduly 팀이 ❤️로 만들었습니다
