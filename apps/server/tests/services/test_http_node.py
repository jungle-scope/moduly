"""
HTTP Request Node 최소 테스트 (unittest 버전)

[이 테스트 파일이 검증하는 것들]
1. 데이터 포장 검증: 노드가 URL, 헤더, 바디를 올바르게 조립하는지 확인합니다.
2. 로직 검증:
   - 변수가 URL/헤더에 잘 치환되어 들어가는지 ({{ .. }} -> 값)
   - 인증(Bearer/API Key) 설정 시 헤더가 자동으로 잘 붙는지
   - Body가 있을 때 Content-Type이 자동으로 붙는지
3. 응답 처리 검증: 라이브러리가 준 응답(Mock)을 노드 출력 포맷에 맞게 잘 변환하는지

* 주의: 실제 인터넷으로 요청을 보내지는 않습니다 (Mock 사용).

실행 방법:
    cd apps/server
    .venv\Scripts\python.exe tests/services/test_http_node.py
"""

import os
import sys
import unittest

# Add project root to sys.path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from unittest.mock import Mock, patch

from workflow.nodes.base.entities import NodeStatus
from workflow.nodes.http import HttpRequestNode, HttpRequestNodeData
from workflow.nodes.http.entities import HttpMethod


class TestHttpNode(unittest.TestCase):
    def test_http_node_basic_get(self):
        """
        기본 GET 요청 테스트

        [검증 포인트]
        1. 내가 입력한 URL(https://api.example.com/users)을 정확히 들고 갔는가?
        2. GET 메서드로 요청하려고 했는가?
        3. 응답이 왔을 때(Mock), 그걸 내 결과 포맷({status, body})으로 잘 변환했는가?
        """
        # Given: HTTP GET 노드 생성
        node_data = HttpRequestNodeData(
            title="GET 요청",
            method=HttpMethod.GET,
            url="https://api.example.com/users",
            timeout=5000,
        )
        node = HttpRequestNode(id="http-1", data=node_data)

        # When: Mock 응답으로 실행
        with patch("httpx.Client") as mock_client:
            # Mock 응답 설정
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"id": 1, "name": "John"}
            mock_response.headers = {"content-type": "application/json"}

            # httpx.Client().request() 호출 시 mock_response 반환
            mock_client.return_value.__enter__.return_value.request.return_value = (
                mock_response
            )

            # 노드 실행
            outputs = node.execute({})

            # [중요] 실제로는 요청이 안 나가지만, "올바른 주소로 요청하려 했는지"는 Mock에게 물어볼 수 있음
            # call_args를 통해 노드가 라이브러리에게 넘긴 인자(URL 등)를 검사
            call_kwargs = (
                mock_client.return_value.__enter__.return_value.request.call_args.kwargs
            )
            self.assertEqual(
                call_kwargs["url"],
                "https://api.example.com/users",
                "URL을 잘못 입력했음!",
            )
            self.assertEqual(call_kwargs["method"], "GET", "GET 변환이 잘못됨!")

        # Then: 응답 검증
        self.assertEqual(outputs["status"], 200)
        self.assertEqual(outputs["data"]["id"], 1)
        self.assertEqual(node.status, NodeStatus.COMPLETED)

    def test_http_node_post_with_body(self):
        """POST 요청 with Body 테스트"""
        # Given
        node_data = HttpRequestNodeData(
            title="POST 요청",
            method=HttpMethod.POST,
            url="https://api.example.com/posts",
            body='{"title": "New Post"}',
            timeout=5000,
        )
        node = HttpRequestNode(id="http-1", data=node_data)

        # When
        with patch("httpx.Client") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 201
            mock_response.json.return_value = {"id": 101}
            mock_response.headers = {}
            mock_client.return_value.__enter__.return_value.request.return_value = (
                mock_response
            )

            outputs = node.execute({})

            # Content-Type 자동 추가 확인
            call_kwargs = (
                mock_client.return_value.__enter__.return_value.request.call_args.kwargs
            )
            self.assertEqual(call_kwargs["headers"]["Content-Type"], "application/json")

        # Then
        self.assertEqual(outputs["status"], 201)

    def test_http_node_bearer_auth(self):
        """Bearer Token 인증 테스트"""
        # Given
        node_data = HttpRequestNodeData(
            title="Bearer 인증",
            method=HttpMethod.GET,
            url="https://api.example.com/protected",
            authType="bearer",
            authConfig={"token": "my-token"},
            timeout=5000,
        )
        node = HttpRequestNode(id="http-1", data=node_data)

        # When
        with patch("httpx.Client") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"data": "protected"}
            mock_response.headers = {}
            mock_client.return_value.__enter__.return_value.request.return_value = (
                mock_response
            )

            outputs = node.execute({})

            # Authorization 헤더 확인
            call_kwargs = (
                mock_client.return_value.__enter__.return_value.request.call_args.kwargs
            )
            self.assertEqual(call_kwargs["headers"]["Authorization"], "Bearer my-token")

        # Then
        self.assertEqual(outputs["status"], 200)

    def test_http_node_variable_substitution(self):
        """변수 치환 테스트"""
        # Given
        node_data = HttpRequestNodeData(
            title="변수 치환",
            method=HttpMethod.GET,
            url="https://api.example.com/users/{{Start.userId}}",
            timeout=5000,
        )
        node = HttpRequestNode(id="http-1", data=node_data)

        # When
        with patch("httpx.Client") as mock_client:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"id": 123}
            mock_response.headers = {}
            mock_client.return_value.__enter__.return_value.request.return_value = (
                mock_response
            )

            # Start 노드의 출력을 inputs로 전달
            inputs = {"Start": {"userId": "123"}}
            outputs = node.execute(inputs)

            # URL이 치환되었는지 확인
            call_kwargs = (
                mock_client.return_value.__enter__.return_value.request.call_args.kwargs
            )
            self.assertEqual(call_kwargs["url"], "https://api.example.com/users/123")

        # Then
        self.assertEqual(outputs["status"], 200)


if __name__ == "__main__":
    unittest.main()
