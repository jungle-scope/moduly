"""
OpenAI용 LLM 클라이언트.

실제 SDK 대신 HTTP 호출로 동작하며, 응답/에러를 단순 래핑합니다.
"""

from typing import Any, Dict, List

import httpx
import tiktoken

from .base import BaseLLMClient


class OpenAIClient(BaseLLMClient):
    """
    OpenAI 클라이언트.

    credentials 예시:
    {
        "apiKey": "sk-...",
        "baseUrl": "https://api.openai.com/v1"
    }
    """

    def __init__(self, model_id: str, credentials: Dict[str, Any], provider_name: str = "OpenAI"):
        super().__init__(model_id=model_id, credentials=credentials)
        self.provider_name = provider_name
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")
        if not self.api_key or not self.base_url:
            raise ValueError(f"{self.provider_name} credentials에 apiKey/baseUrl가 필요합니다.")
        self.chat_url = self.base_url.rstrip("/") + "/chat/completions"
        self.completions_url = self.base_url.rstrip("/") + "/completions"
        self.responses_url = self.base_url.rstrip("/") + "/responses"
        self.embedding_url = self.base_url.rstrip("/") + "/embeddings"
        self._clean_model_id = self.model_id.replace("models/", "").lower()
        # 토큰 계산용 인코더를 인스턴스에 캐시
        self._token_encoder = None

    _STRICT_MAX_COMPLETION_MODELS = {
        "gpt-5.2-pro",
        "gpt-5.2",
        "gpt-5.1",
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
        "o3-pro",
        "o3",
        "o3-mini",
        "o4-mini",
        "o1-pro",
        "o1",
        "gpt-realtime",
        "gpt-realtime-mini",
    }

    _STRICT_TEMPERATURE_ONLY_MODELS = _STRICT_MAX_COMPLETION_MODELS

    _LONG_TIMEOUT_PREFIXES = ("gpt-5", "o1", "o3", "o4")

    def _get_chat_timeout(self) -> int:
        if self._clean_model_id.startswith(self._LONG_TIMEOUT_PREFIXES):
            return 180
        return 60

    def _normalize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(params)
        if self._clean_model_id in self._STRICT_MAX_COMPLETION_MODELS:
            if "max_tokens" in normalized:
                normalized.setdefault("max_completion_tokens", normalized["max_tokens"])
                normalized.pop("max_tokens", None)
        if self._clean_model_id in self._STRICT_TEMPERATURE_ONLY_MODELS:
            if "temperature" in normalized and normalized["temperature"] != 1:
                normalized["temperature"] = 1
        return normalized

    def _build_completion_prompt(self, messages: List[Dict[str, Any]]) -> str:
        lines: List[str] = []
        for msg in messages:
            role = str(msg.get("role") or "").strip()
            content = msg.get("content")
            if content is None:
                continue
            if role:
                lines.append(f"{role.capitalize()}: {content}")
            else:
                lines.append(str(content))
        if lines and not lines[-1].startswith("Assistant:"):
            lines.append("Assistant:")
        return "\n".join(lines)

    def _convert_completion_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return data
        choices = data.get("choices") or []
        if choices and isinstance(choices, list):
            if "message" in choices[0]:
                return data
            if "text" in choices[0]:
                converted_choices = []
                for c in choices:
                    converted_choices.append(
                        {
                            "message": {
                                "role": "assistant",
                                "content": c.get("text", ""),
                            },
                            "finish_reason": c.get("finish_reason"),
                        }
                    )
                return {
                    "choices": converted_choices,
                    "usage": data.get("usage", {}),
                }
        return data

    def _convert_responses_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(data, dict):
            return data
        if "choices" in data:
            return data

        usage = data.get("usage", {})
        if not isinstance(usage, dict):
            usage = {}
        mapped_usage = dict(usage)
        if "prompt_tokens" not in mapped_usage and "input_tokens" in mapped_usage:
            mapped_usage["prompt_tokens"] = mapped_usage.get("input_tokens", 0)
        if "completion_tokens" not in mapped_usage and "output_tokens" in mapped_usage:
            mapped_usage["completion_tokens"] = mapped_usage.get("output_tokens", 0)
        if (
            "total_tokens" not in mapped_usage
            and "prompt_tokens" in mapped_usage
            and "completion_tokens" in mapped_usage
        ):
            mapped_usage["total_tokens"] = (
                mapped_usage.get("prompt_tokens", 0)
                + mapped_usage.get("completion_tokens", 0)
            )

        text = ""
        if isinstance(data.get("output_text"), str):
            text = data.get("output_text", "")
        else:
            output = data.get("output") or []
            for item in output:
                if not isinstance(item, dict):
                    continue
                if isinstance(item.get("text"), str):
                    text += item.get("text", "")
                contents = item.get("content") or []
                for content in contents:
                    if isinstance(content, dict):
                        if content.get("type") in ("output_text", "text"):
                            text += str(content.get("text", ""))
                    elif isinstance(content, str):
                        text += content

        finish_reason = None
        output_items = data.get("output") or []
        if output_items and isinstance(output_items[0], dict):
            finish_reason = output_items[0].get("finish_reason") or output_items[0].get(
                "status"
            )

        return {
            "choices": [
                {
                    "message": {"role": "assistant", "content": text},
                    "finish_reason": finish_reason,
                }
            ],
            "usage": mapped_usage,
        }

    def _content_to_input_blocks(self, content: Any) -> List[Dict[str, Any]]:
        if content is None:
            return []
        if isinstance(content, str):
            return [{"type": "input_text", "text": content}]
        if isinstance(content, list):
            blocks: List[Dict[str, Any]] = []
            for item in content:
                if isinstance(item, str):
                    blocks.append({"type": "input_text", "text": item})
                elif isinstance(item, dict):
                    item_type = item.get("type")
                    if item_type in ("text", "input_text") and "text" in item:
                        blocks.append({"type": "input_text", "text": item.get("text", "")})
                    else:
                        blocks.append(item)
            return blocks
        return [{"type": "input_text", "text": str(content)}]

    def _build_responses_payload(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        instructions_parts: List[str] = []
        input_items: List[Dict[str, Any]] = []

        for msg in messages:
            role = msg.get("role") or "user"
            blocks = self._content_to_input_blocks(msg.get("content"))

            if role == "system":
                for block in blocks:
                    if block.get("type") == "input_text":
                        instructions_parts.append(str(block.get("text", "")))
                continue

            if blocks:
                input_items.append({"role": role, "content": blocks})

        payload: Dict[str, Any] = {}
        instructions = "\n".join([p for p in instructions_parts if p])
        if instructions:
            payload["instructions"] = instructions

        payload["input"] = input_items if input_items else ""
        return payload

    def _summarize_responses_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        summary: Dict[str, Any] = {"model": payload.get("model")}
        instructions = payload.get("instructions")
        summary["instructions_len"] = len(instructions) if isinstance(instructions, str) else 0

        input_data = payload.get("input")
        if isinstance(input_data, str):
            summary["input_type"] = "str"
            summary["input_len"] = len(input_data)
        elif isinstance(input_data, list):
            summary["input_type"] = "list"
            summary["input_items"] = len(input_data)
            roles = []
            block_types: Dict[str, int] = {}
            text_len = 0
            for item in input_data:
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                if role:
                    roles.append(role)
                contents = item.get("content") or []
                for content in contents:
                    if isinstance(content, dict):
                        ctype = content.get("type")
                        if ctype:
                            block_types[ctype] = block_types.get(ctype, 0) + 1
                        if isinstance(content.get("text"), str):
                            text_len += len(content.get("text", ""))
                    elif isinstance(content, str):
                        text_len += len(content)
            summary["roles"] = sorted(set(roles))
            summary["block_types"] = block_types
            summary["content_text_len"] = text_len
        else:
            summary["input_type"] = type(input_data).__name__

        return summary

    def _summarize_responses_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        summary: Dict[str, Any] = {}
        output_text = data.get("output_text")
        summary["output_text_len"] = len(output_text) if isinstance(output_text, str) else 0

        output = data.get("output") or []
        summary["output_items"] = len(output) if isinstance(output, list) else 0
        output_types: Dict[str, int] = {}
        content_types: Dict[str, int] = {}
        content_text_len = 0
        if isinstance(output, list):
            for item in output:
                if not isinstance(item, dict):
                    continue
                itype = item.get("type")
                if itype:
                    output_types[itype] = output_types.get(itype, 0) + 1
                contents = item.get("content") or []
                for content in contents:
                    if isinstance(content, dict):
                        ctype = content.get("type")
                        if ctype:
                            content_types[ctype] = content_types.get(ctype, 0) + 1
                        if isinstance(content.get("text"), str):
                            content_text_len += len(content.get("text", ""))
                    elif isinstance(content, str):
                        content_text_len += len(content)
        summary["output_types"] = output_types
        summary["content_types"] = content_types
        summary["content_text_len"] = content_text_len

        usage = data.get("usage")
        if isinstance(usage, dict):
            summary["usage_keys"] = sorted(list(usage.keys()))
        else:
            summary["usage_keys"] = []

        return summary

    def _summarize_error(self, data: Dict[str, Any]) -> Dict[str, Any]:
        error_info = data.get("error") if isinstance(data, dict) else {}
        if not isinstance(error_info, dict):
            return {"has_error": False}
        return {
            "has_error": True,
            "message": str(error_info.get("message", "")),
            "type": error_info.get("type"),
            "param": error_info.get("param"),
            "code": error_info.get("code"),
        }

    def _handle_not_chat_model(
        self,
        payload: Dict[str, Any],
        messages: List[Dict[str, Any]],
        timeout_seconds: int,
        error_text: str,
    ) -> Dict[str, Any] | None:
        responses_payload = dict(payload)
        responses_payload.pop("messages", None)
        responses_payload.update(self._build_responses_payload(messages))
        if "max_output_tokens" not in responses_payload:
            if "max_completion_tokens" in responses_payload:
                responses_payload["max_output_tokens"] = responses_payload[
                    "max_completion_tokens"
                ]
            elif "max_tokens" in responses_payload:
                responses_payload["max_output_tokens"] = responses_payload["max_tokens"]
        responses_payload.pop("max_completion_tokens", None)
        responses_payload.pop("max_tokens", None)

        try:
            responses_resp = requests.post(
                self.responses_url,
                headers=self._build_headers(),
                json=responses_payload,
                timeout=timeout_seconds,
            )
        except requests.RequestException as exc:
            raise ValueError(f"{self.provider_name} 호출 실패: {exc}") from exc

        if responses_resp.status_code < 400:
            try:
                responses_data = responses_resp.json()
            except ValueError as exc:
                raise ValueError(
                    f"{self.provider_name} 응답을 JSON으로 파싱할 수 없습니다."
                ) from exc
            if not (isinstance(responses_data, dict) and "error" in responses_data):
                return self._convert_responses_response(responses_data)
        else:
            try:
                responses_data = responses_resp.json()
            except ValueError:
                responses_data = {}

        if "completions" in error_text:
            completion_payload = dict(payload)
            completion_payload.pop("messages", None)
            completion_payload["prompt"] = self._build_completion_prompt(messages)
            if "max_completion_tokens" in completion_payload:
                completion_payload.setdefault(
                    "max_tokens", completion_payload["max_completion_tokens"]
                )
                completion_payload.pop("max_completion_tokens", None)
            try:
                completion_resp = requests.post(
                    self.completions_url,
                    headers=self._build_headers(),
                    json=completion_payload,
                    timeout=timeout_seconds,
                )
            except requests.RequestException as exc:
                raise ValueError(f"{self.provider_name} 호출 실패: {exc}") from exc

            if completion_resp.status_code >= 400:
                snippet = completion_resp.text[:200] if completion_resp.text else ""
                raise ValueError(
                    f"{self.provider_name} 호출 실패 (status {completion_resp.status_code}): {snippet}"
                )

            try:
                return self._convert_completion_response(completion_resp.json())
            except ValueError as exc:
                raise ValueError(
                    f"{self.provider_name} 응답을 JSON으로 파싱할 수 없습니다."
                ) from exc

        return None

    def _raise_error_response(self, data: Dict[str, Any], status_code: int | None = None) -> None:
        error_info = data.get("error") if isinstance(data, dict) else None
        if not isinstance(error_info, dict):
            raise ValueError(f"{self.provider_name} 호출 실패: Unknown error")
        message = str(error_info.get("message", "Unknown error"))
        parts = [message]
        for key in ("type", "param", "code"):
            value = error_info.get(key)
            if value:
                parts.append(f"{key}={value}")
        status_text = f" (status {status_code})" if status_code else ""
        raise ValueError(f"{self.provider_name} 호출 실패{status_text}: " + " | ".join(parts))

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def embed(self, text: str) -> List[float]:
        """
        Embeddings API 호출 (비동기).
        """
        payload = {"model": self.model_id, "input": text}

        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(
                    self.embedding_url,
                    headers=self._build_headers(),
                    json=payload,
                )
            except httpx.RequestError as exc:
                raise ValueError(f"{self.provider_name} 임베딩 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            raise ValueError(
                f"{self.provider_name} 임베딩 호출 실패 (status {resp.status_code}): {resp.text[:200]}"
            )

        try:
            data = resp.json()
            # OpenAI response format: { "data": [ { "embedding": [...] } ] }
            return data["data"][0]["embedding"]
        except (ValueError, KeyError, IndexError) as exc:
            raise ValueError(f"{self.provider_name} 임베딩 응답 파싱 실패") from exc

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """
        OpenAI Embeddings API 배치 호출 (최대 2,048개, 비동기)

        Args:
            texts: 임베딩할 텍스트 리스트

        Returns:
            임베딩 벡터 리스트
        """
        if not texts:
            return []

        if len(texts) > 2048:
            raise ValueError(f"OpenAI batch limit is 2,048, got {len(texts)}")

        payload = {"model": self.model_id, "input": texts}

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                resp = await client.post(
                    self.embedding_url,
                    headers=self._build_headers(),
                    json=payload,
                )
            except httpx.RequestError as exc:
                raise ValueError(f"OpenAI 배치 임베딩 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            raise ValueError(
                f"OpenAI 배치 임베딩 호출 실패 (status {resp.status_code}): {resp.text[:200]}"
            )

        try:
            data = resp.json()
            # OpenAI batch response: { "data": [ {"index": 0, "embedding": [...]}, ... ] }
            # index 순서대로 정렬
            sorted_data = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in sorted_data]
        except (ValueError, KeyError, IndexError) as exc:
            raise ValueError("OpenAI 배치 임베딩 응답 파싱 실패") from exc

    async def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Chat Completions 엔드포인트 호출 (비동기).

        Args:
            messages: role/content 형식의 메시지 리스트
            **kwargs: temperature, max_tokens 등 추가 옵션

        Returns:
            응답 JSON 딕셔너리

        Raises:
            ValueError: HTTP 에러/파싱 실패 시
        """
        payload: Dict[str, Any] = {
            "model": self.model_id,
            "messages": messages,
        }
        payload.update(self._normalize_params(kwargs))
        timeout_seconds = self._get_chat_timeout()

        async with httpx.AsyncClient(timeout=60) as client:
            try:
                resp = await client.post(
                    self.chat_url, headers=self._build_headers(), json=payload
                )
            except httpx.RequestError as exc:
                raise ValueError(f"{self.provider_name} 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            if resp.status_code == 400:
                error_text = (resp.text or "").lower()
                retry_payload = None
                needs_retry = False

                if "max_tokens" in error_text and "max_completion_tokens" in error_text:
                    retry_payload = dict(payload) if retry_payload is None else retry_payload
                    retry_payload["max_completion_tokens"] = retry_payload.get(
                        "max_tokens"
                    )
                    retry_payload.pop("max_tokens", None)
                    needs_retry = True

                if "temperature" in error_text and "only the default" in error_text:
                    retry_payload = dict(payload) if retry_payload is None else retry_payload
                    if "temperature" in retry_payload:
                        retry_payload["temperature"] = 1
                        needs_retry = True

                if "unsupported parameter" in error_text:
                    unsupported_params = (
                        "temperature",
                        "top_p",
                        "presence_penalty",
                        "frequency_penalty",
                        "stop",
                    )
                    for param in unsupported_params:
                        if param in error_text:
                            retry_payload = (
                                dict(payload) if retry_payload is None else retry_payload
                            )
                            if param in retry_payload:
                                retry_payload.pop(param, None)
                                needs_retry = True

                if needs_retry and retry_payload is not None:
                    try:
                        resp = requests.post(
                            self.chat_url,
                            headers=self._build_headers(),
                            json=retry_payload,
                            timeout=timeout_seconds,
                        )
                    except requests.RequestException as exc:
                        raise ValueError(
                            f"{self.provider_name} 호출 실패: {exc}"
                        ) from exc

            if resp.status_code == 404:
                error_text = (resp.text or "").lower()
                if "not a chat model" in error_text:
                    handled = self._handle_not_chat_model(
                        payload=payload,
                        messages=messages,
                        timeout_seconds=timeout_seconds,
                        error_text=error_text,
                    )
                    if handled is not None:
                        return handled

            if resp.status_code >= 400:
                snippet = resp.text[:200] if resp.text else ""
                raise ValueError(
                    f"{self.provider_name} 호출 실패 (status {resp.status_code}): {snippet}"
                )

        try:
            data = resp.json()
        except ValueError as exc:
            raise ValueError(f"{self.provider_name} 응답을 JSON으로 파싱할 수 없습니다.") from exc

        if isinstance(data, dict) and "error" in data:
            error_text = str(data.get("error", {}).get("message", "")).lower()
            if "not a chat model" in error_text:
                handled = self._handle_not_chat_model(
                    payload=payload,
                    messages=messages,
                    timeout_seconds=timeout_seconds,
                    error_text=error_text,
                )
                if handled is not None:
                    return handled
            self._raise_error_response(data, resp.status_code)

        return data

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        OpenAI tokenizer(tiktoken) 기반 토큰 수 계산.

        제약/주의:
        - tiktoken이 지원하지 않는 모델명은 cl100k_base로 fallback
        - messages는 role/content 키를 포함한 dict 리스트여야 함
        - 반환값은 최소 1
        """
        if self._token_encoder is None:
            try:
                self._token_encoder = tiktoken.encoding_for_model(self.model_id)
            except Exception:
                self._token_encoder = tiktoken.get_encoding("cl100k_base")

        enc = self._token_encoder

        total_tokens = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_tokens += len(enc.encode(role))
            total_tokens += len(enc.encode(content))

        return max(1, total_tokens)
