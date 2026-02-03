"""
HTTP Request Node 재시도 로직 테스트

[이 테스트 파일이 검증하는 것들]
1. 상태 코드 기반 선별적 재시도 (429, 500, 502, 503, 504)
2. 4xx 클라이언트 에러는 재시도하지 않음
3. 네트워크 오류 (ConnectTimeout, ReadTimeout, ConnectError) 재시도
4. Exponential Backoff with Jitter 대기 시간
5. Retry-After 헤더 준수
6. 최대 재시도 횟수 초과 시 처리
"""

import os
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest

# Add project root to sys.path (moduly 루트 디렉토리 추가)
# 현재 파일: .../moduly/apps/workflow_engine/tests/nodes/test_http_node_retry.py
current_file = Path(__file__).resolve()
project_root = current_file.parent.parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from apps.workflow_engine.workflow.nodes.base.entities import NodeStatus
from apps.workflow_engine.workflow.nodes.http import HttpRequestNode, HttpRequestNodeData
from apps.workflow_engine.workflow.nodes.http.entities import HttpMethod


class MockResponse:
    """HTTP 응답 Mock 객체"""

    def __init__(self, status_code=200, json_data=None, headers=None, text="mock text"):
        self.status_code = status_code
        self._json_data = json_data or {}
        self.headers = headers or {}
        self.text = text

    def json(self):
        return self._json_data


def create_http_node(url="https://api.example.com/test"):
    """테스트용 HTTP 노드 생성 헬퍼"""
    node_data = HttpRequestNodeData(
        title="테스트 요청",
        method=HttpMethod.GET,
        url=url,
        timeout=5000,
        referenced_variables=[],
    )
    return HttpRequestNode(id="http-retry-test", data=node_data)


# =============================================================================
# 재시도 성공 시나리오
# =============================================================================


@pytest.mark.asyncio
async def test_retry_on_503_then_success():
    """503 에러 후 재시도하여 성공하는 케이스"""
    # Given
    node = create_http_node()

    # 1차: 503, 2차: 200 성공
    responses = [
        MockResponse(503, {"error": "Service Unavailable"}),
        MockResponse(200, {"data": "success"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200
            assert outputs["data"]["data"] == "success"
            assert node.status == NodeStatus.COMPLETED

            # 재시도 1회 발생 확인
            assert mock_sleep.call_count == 1
            assert client_instance.request.call_count == 2


@pytest.mark.asyncio
async def test_retry_on_429_with_retry_after_header():
    """429 에러 시 Retry-After 헤더 값을 준수하는지 확인"""
    # Given
    node = create_http_node()

    # 429 응답에 Retry-After: 3 헤더 포함
    responses = [
        MockResponse(429, {"error": "Too Many Requests"}, headers={"Retry-After": "3"}),
        MockResponse(200, {"data": "success"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200

            # Retry-After 헤더 값(3초)으로 대기했는지 확인
            mock_sleep.assert_called_once()
            delay = mock_sleep.call_args.args[0]
            assert delay == 3.0  # Retry-After 헤더 값


@pytest.mark.asyncio
async def test_retry_on_500_502_504():
    """500, 502, 504 에러도 재시도되는지 확인"""
    retryable_codes = [500, 502, 504]

    for status_code in retryable_codes:
        # Given
        node = create_http_node()

        responses = [
            MockResponse(status_code, {"error": f"Error {status_code}"}),
            MockResponse(200, {"data": "success"}),
        ]

        with patch("httpx.AsyncClient") as MockClient:
            client_instance = MockClient.return_value
            client_instance.__aenter__.return_value = client_instance
            client_instance.request = AsyncMock(side_effect=responses)

            with patch("asyncio.sleep", new_callable=AsyncMock):
                # When
                outputs = await node.execute({})

                # Then
                assert outputs["status"] == 200, f"{status_code} 에러 후 재시도 실패"
                assert client_instance.request.call_count == 2


# =============================================================================
# 재시도 안 하는 시나리오
# =============================================================================


@pytest.mark.asyncio
async def test_no_retry_on_4xx_client_errors():
    """4xx 클라이언트 에러는 재시도하지 않음"""
    non_retryable_codes = [400, 401, 403, 404, 405, 422]

    for status_code in non_retryable_codes:
        # Given
        node = create_http_node()

        with patch("httpx.AsyncClient") as MockClient:
            client_instance = MockClient.return_value
            client_instance.__aenter__.return_value = client_instance
            client_instance.request = AsyncMock(
                return_value=MockResponse(status_code, {"error": "Client Error"})
            )

            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                # When
                outputs = await node.execute({})

                # Then
                assert outputs["status"] == status_code
                # 재시도 없이 즉시 반환
                assert mock_sleep.call_count == 0, f"{status_code}에서 재시도가 발생함"
                assert client_instance.request.call_count == 1


@pytest.mark.asyncio
async def test_no_retry_on_success():
    """2xx 성공 응답은 즉시 반환"""
    # Given
    node = create_http_node()

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(
            return_value=MockResponse(200, {"data": "success"})
        )

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200
            assert mock_sleep.call_count == 0
            assert client_instance.request.call_count == 1


# =============================================================================
# 재시도 소진 시나리오
# =============================================================================


@pytest.mark.asyncio
async def test_retry_exhausted_returns_last_response():
    """최대 재시도 횟수 초과 시 마지막 응답 반환"""
    # Given
    node = create_http_node()

    # 4번 모두 503 (MAX_RETRIES=3이므로 초기 1회 + 재시도 3회 = 4회)
    responses = [
        MockResponse(503, {"error": "attempt 1"}),
        MockResponse(503, {"error": "attempt 2"}),
        MockResponse(503, {"error": "attempt 3"}),
        MockResponse(503, {"error": "attempt 4"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            outputs = await node.execute({})

            # Then - 마지막 503 응답 반환
            assert outputs["status"] == 503
            assert outputs["data"]["error"] == "attempt 4"

            # 재시도 3회 발생
            assert mock_sleep.call_count == 3
            assert client_instance.request.call_count == 4


# =============================================================================
# 네트워크 오류 시나리오
# =============================================================================


@pytest.mark.asyncio
async def test_retry_on_connect_timeout():
    """ConnectTimeout 발생 시 재시도"""
    # Given
    node = create_http_node()

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance

        # 1차: ConnectTimeout, 2차: 성공
        client_instance.request = AsyncMock(
            side_effect=[
                httpx.ConnectTimeout("Connection timed out"),
                MockResponse(200, {"data": "success"}),
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200
            assert mock_sleep.call_count == 1
            assert client_instance.request.call_count == 2


@pytest.mark.asyncio
async def test_retry_on_read_timeout():
    """ReadTimeout 발생 시 재시도"""
    # Given
    node = create_http_node()

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance

        client_instance.request = AsyncMock(
            side_effect=[
                httpx.ReadTimeout("Read timed out"),
                MockResponse(200, {"data": "success"}),
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200


@pytest.mark.asyncio
async def test_retry_on_connect_error():
    """ConnectError 발생 시 재시도"""
    # Given
    node = create_http_node()

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance

        client_instance.request = AsyncMock(
            side_effect=[
                httpx.ConnectError("Connection failed"),
                MockResponse(200, {"data": "success"}),
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            # When
            outputs = await node.execute({})

            # Then
            assert outputs["status"] == 200


@pytest.mark.asyncio
async def test_network_error_exhausted_raises_runtime_error():
    """네트워크 오류 재시도 소진 시 RuntimeError 발생"""
    # Given
    node = create_http_node()

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance

        # 4번 모두 ConnectTimeout
        client_instance.request = AsyncMock(
            side_effect=[
                httpx.ConnectTimeout("timeout 1"),
                httpx.ConnectTimeout("timeout 2"),
                httpx.ConnectTimeout("timeout 3"),
                httpx.ConnectTimeout("timeout 4"),
            ]
        )

        with patch("asyncio.sleep", new_callable=AsyncMock):
            # When & Then
            with pytest.raises(RuntimeError) as exc_info:
                await node.execute({})

            assert "최대 재시도 초과" in str(exc_info.value)


# =============================================================================
# Exponential Backoff 테스트
# =============================================================================


@pytest.mark.asyncio
async def test_exponential_backoff_timing():
    """재시도 대기 시간이 지수적으로 증가하는지 확인"""
    # Given
    node = create_http_node()

    responses = [
        MockResponse(503),
        MockResponse(503),
        MockResponse(503),
        MockResponse(200, {"data": "success"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            await node.execute({})

            # Then - 3번의 sleep 호출
            assert mock_sleep.call_count == 3

            calls = mock_sleep.call_args_list
            delay1 = calls[0].args[0]
            delay2 = calls[1].args[0]
            delay3 = calls[2].args[0]

            # Jitter(0~0.5초)를 감안한 범위 검증
            # 1차: 1.0 ~ 1.5초 (BASE_DELAY * 2^0 + jitter)
            assert 1.0 <= delay1 <= 1.5, f"1차 대기 시간 오류: {delay1}"
            # 2차: 2.0 ~ 2.5초 (BASE_DELAY * 2^1 + jitter)
            assert 2.0 <= delay2 <= 2.5, f"2차 대기 시간 오류: {delay2}"
            # 3차: 4.0 ~ 4.5초 (BASE_DELAY * 2^2 + jitter)
            assert 4.0 <= delay3 <= 4.5, f"3차 대기 시간 오류: {delay3}"


@pytest.mark.asyncio
async def test_max_delay_cap():
    """MAX_DELAY를 초과하지 않는지 확인"""
    # Given
    node = create_http_node()
    # MAX_DELAY = 10.0 이므로, 많은 재시도를 해도 10초를 넘지 않아야 함

    # 테스트를 위해 임시로 MAX_RETRIES를 높여서 확인
    original_max_retries = HttpRequestNode.MAX_RETRIES
    HttpRequestNode.MAX_RETRIES = 10  # 충분히 높게 설정

    try:
        responses = [MockResponse(503)] * 11 + [MockResponse(200)]

        with patch("httpx.AsyncClient") as MockClient:
            client_instance = MockClient.return_value
            client_instance.__aenter__.return_value = client_instance
            client_instance.request = AsyncMock(side_effect=responses)

            with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
                # When
                await node.execute({})

                # Then - 모든 대기 시간이 MAX_DELAY(10.5 = 10 + jitter) 이하
                for call in mock_sleep.call_args_list:
                    delay = call.args[0]
                    assert delay <= 10.5, f"MAX_DELAY 초과: {delay}"

    finally:
        # 원복
        HttpRequestNode.MAX_RETRIES = original_max_retries


# =============================================================================
# 기타 엣지 케이스
# =============================================================================


@pytest.mark.asyncio
async def test_retry_after_header_exceeds_max_delay():
    """Retry-After 헤더 값이 MAX_DELAY를 초과할 경우 제한"""
    # Given
    node = create_http_node()

    responses = [
        MockResponse(429, headers={"Retry-After": "60"}),  # 60초 (MAX_DELAY=10 초과)
        MockResponse(200, {"data": "success"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            await node.execute({})

            # Then - MAX_DELAY(10초)로 제한됨
            delay = mock_sleep.call_args.args[0]
            assert delay == 10.0  # min(60, MAX_DELAY)


@pytest.mark.asyncio
async def test_invalid_retry_after_header_fallback():
    """Retry-After 헤더가 유효하지 않을 경우 기본 백오프 사용"""
    # Given
    node = create_http_node()

    responses = [
        MockResponse(429, headers={"Retry-After": "invalid"}),  # 파싱 불가
        MockResponse(200, {"data": "success"}),
    ]

    with patch("httpx.AsyncClient") as MockClient:
        client_instance = MockClient.return_value
        client_instance.__aenter__.return_value = client_instance
        client_instance.request = AsyncMock(side_effect=responses)

        with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
            # When
            await node.execute({})

            # Then - 기본 백오프 사용 (1.0 ~ 1.5초)
            delay = mock_sleep.call_args.args[0]
            assert 1.0 <= delay <= 1.5
