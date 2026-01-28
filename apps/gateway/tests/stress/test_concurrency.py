import asyncio
import time
import uuid
import warnings
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

# 모든 경고 강력 차단 (Pydantic, CryptographyDeprecationWarning 등)
# Import나 Pytest 실행 시점 관계없이 모두 무시
warnings.filterwarnings("ignore")

# Pytest 실행 중 경고 무시 (이중 차단)
pytestmark = pytest.mark.filterwarnings("ignore")

from apps.gateway.api.deps import get_db
from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.main import app
from apps.shared.db.models.knowledge import Document
from apps.shared.db.models.user import User


@pytest.fixture(scope="function")
def context_overrides():
    """
    FastAPI 의존성 주입을 오버라이딩합니다.
    """
    # 1. Mock DB Session
    mock_session = MagicMock()

    # Mock Document (Waiting for Approval 상태)
    mock_db_doc = MagicMock(spec=Document)
    mock_db_doc.status = "waiting_for_approval"
    mock_db_doc.meta_info = {}

    # query().filter().first() 체이닝
    mock_session.query.return_value.filter.return_value.first.return_value = mock_db_doc

    # 2. Mock User
    mock_user = User(id=uuid.uuid4(), email="test@moduly.ai")

    # Override 설정
    app.dependency_overrides[get_db] = lambda: mock_session
    app.dependency_overrides[get_current_user] = lambda: mock_user

    yield mock_session

    # 테스트 종료 후 초기화
    app.dependency_overrides = {}


@pytest.mark.asyncio
@patch("apps.shared.celery_app.celery_app.send_task")
async def test_bulk_parsing_request_performance(mock_send_task, context_overrides):
    """
    [동시성 테스트]
    AsyncClient와 asyncio.gather를 사용하여 100개의 요청을 '동시에' 쏟아붓습니다.
    Celery 비동기 처리가 없다면 서버가 블로킹되어 전체 시간이 길어지겠지만,
    비동기 처리 덕분에 매우 빠르게 반환되어야 합니다.
    """
    # 1. Setup
    doc_count = 100
    doc_ids = [uuid.uuid4() for _ in range(doc_count)]

    print(f"\n🚀 Starting CONCURRENT bulk request test for {doc_count} documents...")

    # 2. Action: 100개 요청 동시 전송 (Fire and Forget)
    start_time = time.time()

    # Fixture 문제 해결을 위해 내부에서 직접 Client 생성 (ASGITransport 사용)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:

        async def send_request(doc_id):
            return await async_client.post(
                f"/api/v1/rag/document/{doc_id}/confirm",
                json={},
                params={"strategy": "llamaparse"},
            )

        # asyncio.gather로 100개 코루틴 동시 실행
        responses = await asyncio.gather(*(send_request(uid) for uid in doc_ids))

    end_time = time.time()
    total_duration = end_time - start_time
    # 0으로 나누기 방지
    avg_per_req = total_duration / doc_count if doc_count > 0 else 0

    # 3. 결과 분석
    success_count = 0
    errors = []
    for res in responses:
        if res.status_code == 200:
            success_count += 1
        else:
            if len(errors) < 3:
                errors.append(f"Status: {res.status_code}, Body: {res.text}")

    print(f"✅ Completed {success_count}/{doc_count} requests.")
    print(f"⏱️ Total Duration (Concurrent): {total_duration:.4f}s")
    print(f"⚡ Avg Latency (Effective): {avg_per_req:.4f}s")

    # 4. Assertions
    if errors:
        print("\n[Error Samples]")
        for err in errors:
            print(err)

    assert success_count == doc_count, "Some requests failed!"

    # 동시성 테스트이므로 순차처리보다 훨씬 빨라야 함
    assert total_duration < 3.0, f"Too slow! Took {total_duration}s"

    # Celery 태스크 호출 횟수 검증
    assert mock_send_task.call_count == doc_count
