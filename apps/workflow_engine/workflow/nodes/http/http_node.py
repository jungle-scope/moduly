import asyncio
import json
import logging
import random
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)
from jinja2 import Environment

from apps.workflow_engine.workflow.nodes.base.node import Node
from apps.workflow_engine.workflow.nodes.http.entities import HttpRequestNodeData

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


def _set_nested_value(data: Dict[str, Any], keys: list[str], value: Any):
    """
    중첩된 딕셔너리에 값을 설정합니다. (점 표기법 지원용)
    """
    current = data
    for i, key in enumerate(keys[:-1]):
        if key not in current:
            current[key] = {}
        
        if not isinstance(current[key], dict):
            current[key] = {}
            
        current = current[key]
    
    current[keys[-1]] = value


class HttpRequestNode(Node[HttpRequestNodeData]):  # Node 상속
    """
    HTTP 요청을 수행하는 노드입니다.
    외부 API 호출 등에 사용됩니다.
    """

    node_type = "httpRequestNode"

    # 재시도 정책 상수
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
    MAX_RETRIES = 3
    BASE_DELAY = 1.0  # 초기 대기 시간 (초)
    MAX_DELAY = 10.0  # 최대 대기 시간 (초)

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        HTTP 요청을 실행하고 응답을 반환합니다 (비동기).
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

        # 4. HTTP 요청 실행 (비동기) - 재시도 정책 적용
        method = data.method.value
        timeout = data.timeout / 1000.0  # ms -> seconds

        last_exception = None
        last_response = None

        for attempt in range(self.MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    # 현재는 JSON만 지원
                    # TODO: 추후 다른 Content-Type 지원 시 여기에 분기 추가

                    if body:
                        try:
                            json_body = json.loads(body)

                            response = await client.request(
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
                            # JSON 파싱 실패는 재시도 불가 (클라이언트 오류)
                            raise ValueError(
                                f"Body는 유효한 JSON 형식이어야 합니다: {str(e)}"
                            )
                    else:
                        # Body가 없는 경우 (GET 요청 등)
                        response = await client.request(
                            method=method,
                            url=url,
                            headers=headers,
                            content=None,
                        )

                    # 5. 상태 코드 기반 선별적 재시도 판단
                    if response.status_code in self.RETRYABLE_STATUS_CODES:
                        last_response = response
                        if attempt < self.MAX_RETRIES:
                            delay = self._calculate_backoff(attempt, response)
                            logger.warning(
                                f"[HTTP 재시도] {url} - 상태 코드 {response.status_code}, "
                                f"{attempt + 1}/{self.MAX_RETRIES}회 재시도 예정 ({delay:.2f}초 후)"
                            )
                            await asyncio.sleep(delay)
                            continue
                        # 최대 재시도 초과 시 마지막 응답 반환
                        logger.error(
                            f"[HTTP 재시도 실패] {url} - 최대 재시도 횟수 초과 (상태 코드: {response.status_code})"
                        )

                    # 6. 응답 처리 (성공 또는 재시도 불가 에러)
                    try:
                        response_body = response.json()
                    except json.JSONDecodeError:
                        response_body = response.text

                    return {
                        "status": response.status_code,
                        "data": response_body,
                        "headers": dict(response.headers),
                    }

            except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as e:
                # 네트워크 오류는 재시도 대상
                last_exception = e
                if attempt < self.MAX_RETRIES:
                    delay = self._calculate_backoff(attempt)
                    logger.warning(
                        f"[HTTP 재시도] {url} - 네트워크 오류 ({type(e).__name__}), "
                        f"{attempt + 1}/{self.MAX_RETRIES}회 재시도 예정 ({delay:.2f}초 후)"
                    )
                    await asyncio.sleep(delay)
                    continue
                # 최대 재시도 초과
                logger.error(f"[HTTP 재시도 실패] {url} - 최대 재시도 횟수 초과")
                raise RuntimeError(f"HTTP 요청 실패 (최대 재시도 초과): {str(e)}")

            except httpx.RequestError as e:
                # 기타 요청 오류 (재시도 불가)
                raise RuntimeError(f"HTTP 요청 실패: {str(e)}")

        # 마지막 응답이 있으면 반환 (재시도 모두 실패한 경우)
        if last_response is not None:
            try:
                response_body = last_response.json()
            except json.JSONDecodeError:
                response_body = last_response.text
            return {
                "status": last_response.status_code,
                "data": response_body,
                "headers": dict(last_response.headers),
            }

        # 예외만 발생한 경우
        raise RuntimeError(f"HTTP 요청 실패: {last_exception}")

    def _calculate_backoff(self, attempt: int, response: httpx.Response = None) -> float:
        """
        재시도 대기 시간 계산 (Exponential Backoff with Jitter)

        Args:
            attempt: 현재 시도 횟수 (0부터 시작)
            response: HTTP 응답 (Retry-After 헤더 확인용)

        Returns:
            대기 시간 (초)
        """
        # Retry-After 헤더 우선 적용 (429 응답 시 서버가 지정한 대기 시간)
        if response is not None:
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                try:
                    return min(float(retry_after), self.MAX_DELAY)
                except ValueError:
                    pass  # 파싱 실패 시 기본 백오프 사용

        # Exponential Backoff: 1초 -> 2초 -> 4초 (2^attempt)
        delay = min(self.BASE_DELAY * (2 ** attempt), self.MAX_DELAY)
        # Jitter 추가 (0~0.5초): Thundering Herd 방지
        jitter = random.uniform(0, 0.5)
        return delay + jitter

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
                val = escaped_val
            
            # 변수명에 점(.)이 있는 경우 중첩 딕셔너리로 처리
            if "." in variable.name:
                keys = variable.name.split(".")
                _set_nested_value(context, keys, val)
            else:
                context[variable.name] = val

        try:
            template = _jinja_env.from_string(template_text)
            return template.render(**context)
        except Exception:
            # 렌더링 실패 시 원본 텍스트 반환 (로깅 필요 시 추가)
            return template_text
