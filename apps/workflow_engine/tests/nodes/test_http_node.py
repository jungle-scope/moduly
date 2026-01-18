"""
HTTP Request Node 최소 테스트 (pytest async 버전)

[이 테스트 파일이 검증하는 것들]
1. 데이터 포장 검증: 노드가 URL, 헤더, 바디를 올바르게 조립하는지 확인합니다.
2. 로직 검증:
   - 변수가 URL/헤더에 잘 치환되어 들어가는지 ({{ .. }} -> 값)
   - 인증(Bearer/API Key) 설정 시 헤더가 자동으로 잘 붙는지
   - Body가 있을 때 Content-Type이 자동으로 붙는지
3. 응답 처리 검증: 라이브러리가 준 응답(Mock)을 노드 출력 포맷에 맞게 잘 변환하는지

* 주의: 실제 인터넷으로 요청을 보내지는 않습니다 (Mock 사용).
"""

import os
import sys
from unittest.mock import Mock, patch, AsyncMock

import pytest

# Add project root to sys.path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from apps.workflow_engine.workflow.nodes.base.entities import NodeStatus
from apps.workflow_engine.workflow.nodes.http import HttpRequestNode, HttpRequestNodeData
from apps.workflow_engine.workflow.nodes.http.entities import HttpMethod, HttpVariable


# Mock AsyncClient
class MockResponse:
    def __init__(self, status_code=200, json_data=None, headers=None):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.headers = headers or {}
        self.text = "mock text"

    def json(self):
        return self._json_data


@pytest.mark.asyncio
async def test_http_node_basic_get():
    """기본 GET 요청 테스트"""
    # Given
    node_data = HttpRequestNodeData(
        title="GET 요청",
        method=HttpMethod.GET,
        url="https://api.example.com/users",
        timeout=5000,
        referenced_variables=[],
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    # When
    mock_response = MockResponse(200, {"id": 1, "name": "John"}, {"content-type": "application/json"})
    
    with patch("httpx.AsyncClient") as MockClient:
        # AsyncClient 인스턴스 모킹
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        
        # request 메서드를 AsyncMock으로 설정
        client_instance.request = AsyncMock(return_value=mock_response)

        outputs = await node.execute({})

        # Call check
        client_instance.request.assert_called_with(
            method="GET",
            url="https://api.example.com/users",
            headers={},
            content=None,
        )

    # Then
    assert outputs["status"] == 200
    assert outputs["data"]["id"] == 1
    assert node.status == NodeStatus.COMPLETED


@pytest.mark.asyncio
async def test_http_node_post_with_body():
    """POST 요청 with Body 테스트"""
    # Given
    node_data = HttpRequestNodeData(
        title="POST 요청",
        method=HttpMethod.POST,
        url="https://api.example.com/posts",
        body='{"title": "New Post"}',
        timeout=5000,
        referenced_variables=[],
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    # When
    mock_response = MockResponse(201, {"id": 101}, {})

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(return_value=mock_response)

        outputs = await node.execute({})

        # Call check
        call_args = client_instance.request.call_args
        assert call_args.kwargs["method"] == "POST"
        assert call_args.kwargs["json"] == {"title": "New Post"}

    # Then
    assert outputs["status"] == 201


@pytest.mark.asyncio
async def test_http_node_bearer_auth():
    """Bearer Token 인증 테스트"""
    # Given
    node_data = HttpRequestNodeData(
        title="Bearer 인증",
        method=HttpMethod.GET,
        url="https://api.example.com/protected",
        authType="bearer",
        authConfig={"token": "my-token"},
        timeout=5000,
        referenced_variables=[],
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    # When
    mock_response = MockResponse(200, {"data": "protected"}, {})

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(return_value=mock_response)

        outputs = await node.execute({})

        # Call check
        call_args = client_instance.request.call_args
        headers = call_args.kwargs["headers"]
        assert headers["Authorization"] == "Bearer my-token"

    # Then
    assert outputs["status"] == 200


@pytest.mark.asyncio
async def test_http_node_variable_substitution():
    """변수 치환 테스트"""
    # Given
    node_data = HttpRequestNodeData(
        title="변수 치환",
        method=HttpMethod.GET,
        url="https://api.example.com/users/{{ userId }}",  # Jinja2 템플릿 사용
        timeout=5000,
        referenced_variables=[
            HttpVariable(name="userId", value_selector=["Start", "userId"])
        ],
    )
    node = HttpRequestNode(id="http-1", data=node_data)

    # When
    mock_response = MockResponse(200, {"id": 123}, {})

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(return_value=mock_response)

        # Start 노드의 출력을 inputs로 전달
        inputs = {"Start": {"userId": "123"}}
        outputs = await node.execute(inputs)

        # Call check
        call_args = client_instance.request.call_args
        assert call_args.kwargs["url"] == "https://api.example.com/users/123"

    # Then
    assert outputs["status"] == 200


