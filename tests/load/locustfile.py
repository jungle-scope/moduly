"""
Locust 워크플로우 부하 테스트

사용법:
  # Web UI 모드 (브라우저에서 http://localhost:8089 접속)
  locust -f tests/load/locustfile.py --host=http://localhost:8000

  # Headless 모드
  locust -f tests/load/locustfile.py --host=http://localhost:8000 \
    --headless --users 10 --spawn-rate 2 --run-time 30s

환경변수 (.env):
  LOAD_TEST_DEPLOYMENT_SLUG: 테스트할 워크플로우 URL slug
  LOAD_TEST_AUTH_TOKEN: 인증 토큰
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from locust import HttpUser, between, events, task

# 프로젝트 루트의 .env 로드
# tests/load/locustfile.py -> tests/load -> tests -> moduly (ROOT)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()  # Fallback


class WorkflowUser(HttpUser):
    """워크플로우 실행 부하 테스트 사용자"""

    wait_time = between(1, 3)  # 요청 사이 대기 시간 (초)

    def on_start(self):
        """테스트 시작 시 환경변수에서 설정 로드"""
        self.deployment_slug = os.getenv("LOAD_TEST_DEPLOYMENT_SLUG")
        self.auth_token = os.getenv("LOAD_TEST_AUTH_TOKEN")

        if not self.deployment_slug:
            raise ValueError("LOAD_TEST_DEPLOYMENT_SLUG 환경변수가 설정되지 않았습니다")
        if not self.auth_token:
            raise ValueError("LOAD_TEST_AUTH_TOKEN 환경변수가 설정되지 않았습니다")

    @task
    def run_workflow(self):
        """배포된 워크플로우 실행 테스트"""
        headers = {
            "X-Auth-Secret": self.auth_token,
            "Content-Type": "application/json",
        }

        # 테스트 입력 데이터
        payload = {
            "inputs": {
                # "score": random.randint(1, 100),
                # "pdf": "https://moduly-dev-file-upload.s3.amazonaws.com/uploads/1e9d5de3-ed0f-4d1c-8aee-53e4afd78fd8/d9aeb862-119e-4c22-9317-36555098eddc_welcome.pdf",
            }
        }

        with self.client.post(
            f"/api/v1/run/{self.deployment_slug}",
            json=payload,
            headers=headers,
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("status") == "success":
                        response.success()
                    else:
                        response.failure(f"Workflow failed: {data}")
                except json.JSONDecodeError as e:
                    response.failure(f"JSON parse error: {e}")
            elif response.status_code == 401:
                response.failure("Authentication failed - check LOAD_TEST_AUTH_TOKEN")
            elif response.status_code == 404:
                response.failure(
                    "Deployment not found - check LOAD_TEST_DEPLOYMENT_SLUG"
                )
            else:
                response.failure(
                    f"HTTP {response.status_code}: {(response.text or '')[:200]}"
                )


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """테스트 시작 시 설정 정보 출력"""
    slug = os.getenv("LOAD_TEST_DEPLOYMENT_SLUG", "NOT SET")
    token = os.getenv("LOAD_TEST_AUTH_TOKEN", "NOT SET")
    token_preview = f"{token[:10]}..." if token != "NOT SET" else "NOT SET"

    print(f"\n{'=' * 50}")
    print("🚀 Locust 부하 테스트 시작")
    print(f"{'=' * 50}")
    print(f"📍 대상 URL Slug: {slug}")
    print(f"🔑 인증 토큰: {token_preview}")
    print(f"{'=' * 50}\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """테스트 종료 시 요약 출력"""
    print(f"\n{'=' * 50}")
    print("✅ 부하 테스트 완료")
    print(f"{'=' * 50}\n")
