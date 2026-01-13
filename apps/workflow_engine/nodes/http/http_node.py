import json
from typing import Any, Dict

import httpx
from jinja2 import Environment

from apps.workflow_engine.nodes.base.node import Node
from apps.workflow_engine.nodes.http.entities import HttpRequestNodeData

_jinja_env = Environment(autoescape=False)


def _get_nested_value(data: Any, keys: list[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


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

        # 1. 템플릿 렌더링 (URL, Headers, Body)
        url = self._render_template(data.url, inputs)
        body = (
            self._render_template(data.body, inputs, json_context=True)
            if data.body
            else None
        )

        headers = {}
        for h in data.headers:
            if h.key and h.key.strip():
                headers[h.key] = self._render_template(h.value, inputs)

        # 2. Authentication 처리
        auth_type = getattr(data, "authType", "none")
        auth_config = getattr(data, "authConfig", {})

        if auth_type == "bearer":
            token = self._render_template(auth_config.get("token", ""), inputs)
            if token:
                headers["Authorization"] = f"Bearer {token}"

        elif auth_type == "apiKey":
            api_key_header = auth_config.get("apiKeyHeader", "X-API-Key")
            api_key_value = self._render_template(
                auth_config.get("apiKeyValue", ""), inputs
            )
            if api_key_value:
                headers[api_key_header] = api_key_value

        # 3. Body 처리
        # 현재는 JSON만 지원 (추후 form-data, XML 등 확장 가능)
        if body:
            # Content-Type이 명시되지 않은 경우 기본값으로 JSON 설정
            content_type_keys = [
                k for k in headers.keys() if k.lower() == "content-type"
            ]
            if not content_type_keys:
                headers["Content-Type"] = "application/json"

        # 4. HTTP 요청 실행
        method = data.method.value
        timeout = data.timeout / 1000.0  # ms -> seconds

        try:
            with httpx.Client(timeout=timeout) as client:
                # 현재는 JSON만 지원
                # TODO: 추후 다른 Content-Type 지원 시 여기에 분기 추가
                # - application/x-www-form-urlencoded
                # - multipart/form-data
                # - text/xml
                # - text/plain

                if body:
                    try:
                        json_body = json.loads(body)

                        response = client.request(
                            method=method,
                            url=url,
                            headers={
                                k: v
                                for k, v in headers.items()
                                if k.lower() != "content-type"
                            },
                            json=json_body,
                        )
                    except json.JSONDecodeError as e:
                        # JSON 파싱 실패 시 에러 발생
                        raise ValueError(
                            f"Body는 유효한 JSON 형식이어야 합니다: {str(e)}"
                        )
                else:
                    # Body가 없는 경우 (GET 요청 등)
                    response = client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        content=None,
                    )

                # 5. 응답 처리
                try:
                    response_body = response.json()
                except json.JSONDecodeError:
                    response_body = response.text

                return {
                    "status": response.status_code,
                    "data": response_body,
                    "headers": dict(response.headers),
                }
        except httpx.RequestError as e:
            raise RuntimeError(f"HTTP 요청 실패: {str(e)}")

    def _render_template(
        self, template_text: str, inputs: Dict[str, Any], json_context: bool = False
    ) -> str:
        """
        Jinja2를 사용하여 템플릿 문자열을 렌더링합니다.
        referenced_variables를 사용하여 컨텍스트를 구성합니다.
        """
        if not template_text:
            return ""

        context = {}
        # data.referenced_variables가 없을 수 있음을 대비
        referenced_variables = getattr(self.data, "referenced_variables", [])

        for variable in referenced_variables:
            val = _get_nested_value(inputs, variable.value_selector)
            val = val if val is not None else ""

            if json_context and isinstance(val, str):
                # JSON 문자열 내에 삽입될 경우, 따옴표와 제어문자를 이스케이프해야 함.
                escaped_val = json.dumps(val)
                if escaped_val.startswith('"') and escaped_val.endswith('"'):
                    escaped_val = escaped_val[1:-1]
                context[variable.name] = escaped_val
            else:
                context[variable.name] = val

        try:
            template = _jinja_env.from_string(template_text)
            return template.render(**context)
        except Exception:
            # 렌더링 실패 시 원본 텍스트 반환 (로깅 필요 시 추가)
            return template_text
