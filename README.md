# Moduly

**AI 애플리케이션을 위한 비주얼 워크플로우 빌더**

Moduly는 직관적인 시각적 인터페이스를 통해 AI 기반 워크플로우를 생성, 배포 및 관리할 수 있는 로우코드/노코드 플랫폼입니다. 코드 없이 복잡한 LLM 애플리케이션을 구축하세요.

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

Kubernetes 클러스터에 배포하려면 다음 명령어를 사용하세요.

1. **기본 설정 파일 생성** (차후 수정)
   ```bash
   helm show values ./infra/helm/moduly > values.yaml
   ```

2. **설정 수정**
   생성된 `values.yaml` 파일을 열어 환경에 맞게 설정을 수정합니다. (도메인, 리소스, 시크릿 등)

3. **설치 및 업데이트**
   ```bash
   helm upgrade --install moduly ./infra/helm/moduly -f values.yaml
   ```

### 초기 설정 (API 키 및 모델)

1. 웹 인터페이스의 **설정(Settings)** 페이지로 이동합니다.
2. **OpenAI, Anthropic, Gemini** 등 사용할 AI 제공업체의 API 키를 등록합니다.
3. 사용할 모델(GPT-4, Claude 3.5 등)을 추가합니다.

이제 Moduly를 사용할 준비가 되었습니다!

## ✨ 주요 기능

- **비주얼 워크플로우 에디터** - React Flow 기반 드래그 앤 드롭 인터페이스
- **다양한 노드 타입** - LLM, HTTP, 코드 실행, 파일 추출, RAG 등
- **유연한 배포 옵션** - REST API, 웹앱, 임베디드 위젯으로 배포 가능
- **실시간 스트리밍** - LLM 노드에서 실시간 응답 스트리밍
- **안전한 코드 실행** - 격리된 샌드박스 환경에서 사용자 코드 실행
- **Docker 지원** - 명령어 한 줄로 전체 스택 실행

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

## 개발

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

## 문서

- [아키텍처 개요](docs/architecture.md)
- [API 레퍼런스](docs/api-reference.md)
- [노드 타입 가이드](docs/node-types.md)
- [배포 가이드](docs/deployment-guide.md)
- [개발 가이드](docs/development.md)

## 기여하기

기여를 환영합니다! 자세한 내용은 [기여 가이드](CONTRIBUTING.md)를 참조하세요.

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

## 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 지원

- 이슈: [GitHub Issues](https://github.com/jungle-scope/moduly/issues)
- 토론: [GitHub Discussions](https://github.com/jungle-scope/moduly/discussions)

---

Moduly 팀이 ❤️로 만들었습니다
