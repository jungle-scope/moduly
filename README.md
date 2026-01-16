# Moduly

**AI 애플리케이션을 위한 비주얼 워크플로우 빌더**

Moduly는 직관적인 시각적 인터페이스를 통해 AI 기반 워크플로우를 생성, 배포 및 관리할 수 있는 로우코드/노코드 플랫폼입니다. 코드 없이 복잡한 LLM 애플리케이션을 구축하세요.

## ✨ 주요 기능

- 🎨 **비주얼 워크플로우 에디터** - React Flow 기반 드래그 앤 드롭 인터페이스
- 🤖 **다양한 노드 타입** - LLM, HTTP, 코드 실행, 파일 추출, RAG 등
- 🚀 **유연한 배포 옵션** - REST API, 웹앱, 임베디드 위젯으로 배포 가능
- ⚡ **실시간 스트리밍** - LLM 노드에서 실시간 응답 스트리밍
- 🔒 **안전한 코드 실행** - 격리된 샌드박스 환경에서 사용자 코드 실행
- 📦 **Docker 지원** - 명령어 한 줄로 전체 스택 실행

## 🚀 빠른 시작

### 사전 요구사항

- Docker & Docker Compose

### 설치 방법

1. **저장소 클론**
   ```bash
   git clone https://github.com/YOUR_USERNAME/moduly.git
   ```

2. **환경 변수 설정 (선택사항)**
   ```bash
   cd docker
   cp .env.example .env
   # .env 파일을 열어 필요한 설정을 수정할 수 있습니다.
   ```

3. **모든 서비스 시작**
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```
   
   > **참고**: 첫 실행 시 이미지 빌드와 DB 마이그레이션이 자동으로 진행됩니다. 완료까지 3-5분 정도 소요됩니다.

4. **애플리케이션 접속**
   
   브라우저에서 다음 주소로 접속:
   - **Moduly 애플리케이션**: http://localhost
   - API 문서: http://localhost/api/docs

   > **✨ 단일 진입점**: Nginx 리버스 프록시를 통해 프론트엔드와 백엔드 모두 `http://localhost`에서 제공됩니다.

5. **API 키 설정**
   - 웹 인터페이스의 설정 페이지로 이동
   - OpenAI API 키 추가 ([여기서 발급](https://platform.openai.com/api-keys))
   - 필요한 다른 통합 구성

완료! 🎉 이제 Moduly를 로컬에서 사용할 수 있습니다.

## 📖 사용 방법

### 첫 워크플로우 만들기

1. http://localhost:3000 접속
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

## 🛠️ 개발

### 로컬 개발 환경 설정

활발한 개발을 위해 서비스를 개별적으로 실행할 수 있습니다:

1. **데이터베이스만 시작**
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **백엔드 로컬 실행**
   ```bash
   cd apps/server
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn apps.server.main:app --reload --port 8000
   ```

3. **프론트엔드 로컬 실행**
   ```bash
   cd apps/client
   npm install
   npm run dev
   ```

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

## 🔧 환경 설정
### 1. 환경변수 파일 생성
\`\`\`bash
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env.local
\`\`\`
### 2. Google OAuth 설정 (선택)
Google 로그인을 사용하려면:
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 프로젝트 생성
2. OAuth 2.0 클라이언트 ID 생성
3. Authorized redirect URIs에 추가:
   - `http://localhost:8000/api/v1/auth/google/callback`
4. [.env](cci:7://file:///Users/soyoungan/dev/moduly/apps/.env:0:0-0:0)에 Client ID와 Secret 입력

## 📚 문서

- [아키텍처 개요](docs/architecture.md)
- [API 레퍼런스](docs/api-reference.md)
- [노드 타입 가이드](docs/node-types.md)
- [배포 가이드](docs/deployment-guide.md)
- [개발 가이드](docs/development.md)

## 🤝 기여하기

기여를 환영합니다! 자세한 내용은 [기여 가이드](CONTRIBUTING.md)를 참조하세요.

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 열기

## 📝 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [React Flow](https://reactflow.dev/)로 구축
- [FastAPI](https://fastapi.tiangolo.com/) 기반
- [Dify Sandbox](https://github.com/langgenius/dify-sandbox)를 통한 코드 실행
- [LangChain](https://www.langchain.com/)을 통한 RAG 기능

## 📧 지원

- 이슈: [GitHub Issues](https://github.com/YOUR_USERNAME/moduly/issues)
- 토론: [GitHub Discussions](https://github.com/YOUR_USERNAME/moduly/discussions)

---

Moduly 팀이 ❤️로 만들었습니다
