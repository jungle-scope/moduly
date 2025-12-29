"""
실제 HTTP 요청 통합 테스트

주의: 인터넷 연결 필요
이 테스트는 실제 외부 API(JSONPlaceholder)에 요청을 보냅니다.

실행 방법:
    cd apps/server
    .venv\Scripts\python.exe tests/integration/test_http_node_real.py
"""

import os
import sys

# Add project root to sys.path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from workflow.nodes.http import HttpRequestNode, HttpRequestNodeData
from workflow.nodes.http.entities import HttpMethod


def test_real_get_request():
    """실제 GET 요청 - JSONPlaceholder API"""
    print("📡 GET 요청 테스트 중...")

    node_data = HttpRequestNodeData(
        title="실제 GET 테스트",
        method=HttpMethod.GET,
        url="https://jsonplaceholder.typicode.com/posts/1",
        timeout=5000,
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    # 실제 요청 실행
    outputs = node.execute({})

    # 검증
    assert outputs["status"] == 200, f"Expected 200, got {outputs['status']}"
    assert outputs["body"]["userId"] == 1, "userId should be 1"
    assert outputs["body"]["id"] == 1, "id should be 1"
    assert "title" in outputs["body"], "Response should have 'title' field"

    print("✅ GET 요청 성공!")
    print(f"   응답 상태: {outputs['status']}")
    print(f"   게시글 제목: {outputs['body']['title']}")
    print(f"   전체 응답: {outputs['body']}\n")


def test_real_post_request():
    """실제 POST 요청 - JSONPlaceholder API"""
    print("📡 POST 요청 테스트 중...")

    node_data = HttpRequestNodeData(
        title="실제 POST 테스트",
        method=HttpMethod.POST,
        url="https://jsonplaceholder.typicode.com/posts",
        body='{"title": "Test Post", "body": "This is a test", "userId": 1}',
        timeout=5000,
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    outputs = node.execute({})

    assert outputs["status"] == 201, f"Expected 201, got {outputs['status']}"
    assert outputs["body"]["id"] == 101, "JSONPlaceholder returns id 101 for new posts"

    print("✅ POST 요청 성공!")
    print(f"   응답 상태: {outputs['status']}")
    print(f"   생성된 ID: {outputs['body']['id']}")
    print(f"   전체 응답: {outputs['body']}\n")


def test_real_get_list():
    """실제 GET 요청 - 목록 조회"""
    print("📡 GET 목록 조회 테스트 중...")

    node_data = HttpRequestNodeData(
        title="목록 조회 테스트",
        method=HttpMethod.GET,
        url="https://jsonplaceholder.typicode.com/posts?userId=1",
        timeout=5000,
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    outputs = node.execute({})

    assert outputs["status"] == 200
    assert isinstance(outputs["body"], list), "Response should be a list"
    assert len(outputs["body"]) > 0, "List should not be empty"

    print("✅ 목록 조회 성공!")
    print(f"   응답 상태: {outputs['status']}")
    print(f"   게시글 개수: {len(outputs['body'])}개")
    print(f"   첫 번째 게시글: {outputs['body'][0]['title']}\n")


def test_real_with_custom_headers():
    """커스텀 헤더를 포함한 실제 요청"""
    print("📡 커스텀 헤더 포함 요청 테스트 중...")

    from workflow.nodes.http.entities import HttpHeader

    node_data = HttpRequestNodeData(
        title="커스텀 헤더 테스트",
        method=HttpMethod.GET,
        url="https://jsonplaceholder.typicode.com/posts/1",
        headers=[
            HttpHeader(key="Accept", value="application/json"),
            HttpHeader(key="User-Agent", value="MyWorkflowEngine/1.0"),
        ],
        timeout=5000,
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    outputs = node.execute({})

    assert outputs["status"] == 200

    print("✅ 커스텀 헤더 요청 성공!")
    print(f"   응답 상태: {outputs['status']}")
    print(f"   응답 헤더: {list(outputs['headers'].keys())[:5]}...\n")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 실제 HTTP 요청 통합 테스트 시작")
    print("=" * 60)
    print()

    try:
        test_real_get_request()
        test_real_post_request()
        test_real_get_list()
        test_real_with_custom_headers()

        print("=" * 60)
        print("🎉 모든 테스트 통과!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n❌ 테스트 실패: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
