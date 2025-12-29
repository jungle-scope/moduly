import json
import re
from typing import Any, Dict

import httpx

from workflow.nodes.base.node import Node
from workflow.nodes.http.entities import HttpRequestNodeData


class HttpRequestNode(Node[HttpRequestNodeData]):  # Node 상속
    """
    HTTP 요청을 수행하는 노드입니다.
    외부 API 호출 등에 사용됩니다.
    """

    node_type = "httpRequestNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        HTTP 요청을 실행하고 응답을 반환합니다.
        """
        data = self.data

        # 1. 변수 치환 로직 (URL, Headers, Body)
        url = self._substitute_variables(data.url, inputs)
        body = self._substitute_variables(data.body, inputs) if data.body else None

        headers = {}
        for h in data.headers:
            headers[h.key] = self._substitute_variables(h.value, inputs)

        # 2. Authentication 처리
        auth_type = getattr(data, "authType", "none")
        auth_config = getattr(data, "authConfig", {})

        if auth_type == "bearer":
            token = self._substitute_variables(auth_config.get("token", ""), inputs)
            if token:
                headers["Authorization"] = f"Bearer {token}"

        elif auth_type == "apiKey":
            api_key_header = auth_config.get("apiKeyHeader", "X-API-Key")
            api_key_value = self._substitute_variables(
                auth_config.get("apiKeyValue", ""), inputs
            )
            if api_key_value:
                headers[api_key_header] = api_key_value

        # 3. Body Type 처리 (현재는 JSON만 지원)
        # Body가 있다면 무조건 Content-Type: application/json 추가
        if body:
            # 사용자가 이미 설정했는지 확인
            content_type_keys = [
                k for k in headers.keys() if k.lower() == "content-type"
            ]
            if not content_type_keys:
                headers["Content-Type"] = "application/json"

            # JSON 유효성 검사 (실패 시 에러 발생 대신 원본 전송 시도하거나 로그 남김 등 선택 가능)
            # 여기서는 편의를 위해 만약 JSON 형식이 아니라면 그대로 전송 (사용자 책임을 남겨둠)

        # 3. HTTP 요청 실행
        method = data.method.value
        timeout = data.timeout / 1000.0  # ms -> seconds

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    content=body,  # httpx는 'content' 인자에 문자열/바이트를 받음
                )

                # 결과 반환
                try:
                    response_body = response.json()
                except json.JSONDecodeError:
                    response_body = response.text

                return {
                    "status": response.status_code,
                    "body": response_body,
                    "headers": dict(response.headers),
                }
        except httpx.RequestError as e:
            raise RuntimeError(f"HTTP 요청 실패: {str(e)}")

    def _substitute_variables(self, text: str, inputs: Dict[str, Any]) -> str:
        """
        텍스트 내의 {{NodeId.variable}} 패턴을 찾아 실제 값으로 치환합니다.

        Args:
            text: 치환할 원본 문자열
            inputs: 현재까지의 실행 결과(컨텍스트)

        Returns:
            치환된 문자열
        """
        if not text:
            return text

        # 정규표현식으로 {{ pattern }} 찾기
        # 예: {{Start.query}} -> group(1): Start.query
        pattern = re.compile(r"\{\{\s*([\w\.]+)\s*\}\}")

        def replace_match(match):
            variable_path = match.group(1).strip()

            # inputs 구조: { "Start": {"query": "value"} } 형태
            # 예: {{Start.query}} -> inputs["Start"]["query"]

            # NodeId.변수명 형태를 파싱
            if "." in variable_path:
                node_id, var_name = variable_path.split(".", 1)
                node_data = inputs.get(node_id)
                if isinstance(node_data, dict) and var_name in node_data:
                    return str(node_data[var_name])

            # 값을 찾지 못하면 원본 유지
            return match.group(0)

        return pattern.sub(replace_match, text)
