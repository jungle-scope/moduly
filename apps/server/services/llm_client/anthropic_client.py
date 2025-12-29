"""
Anthropic(Claude)용 LLM 클라이언트.

- OpenAI 클라이언트와 동일한 형태의 인터페이스를 제공합니다.
- Anthropic Messages API 규격에 맞춰 payload/header를 구성합니다.
"""

from typing import Any, Dict, List, Tuple

import requests

from .base import BaseLLMClient


class AnthropicClient(BaseLLMClient):
    """
    Anthropic 클라이언트.

    credentials 예시:
    {
        "apiKey": "sk-ant-...",
        "baseUrl": "https://api.anthropic.com",
        "anthropicVersion": "2023-06-01"
    }
    """

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        super().__init__(model_id=model_id, credentials=credentials)
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")
        self.anthropic_version = credentials.get("anthropicVersion") or "2023-06-01"

        if not self.api_key or not self.base_url:
            raise ValueError("Anthropic credentials에 apiKey/baseUrl가 필요합니다.")

        self.chat_url = self.base_url.rstrip("/") + "/v1/messages"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.anthropic_version,
            "content-type": "application/json",
        }

    def _convert_messages(
        self, messages: List[Dict[str, Any]]
    ) -> Tuple[str, List[Dict[str, str]]]:
        """
        공통 포맷의 messages를 Anthropic 포맷으로 변환합니다.
        - system 역할은 system 필드에 합쳐서 전달
        - 그 외(role: user/assistant)는 그대로 role + content 문자열로 변환
        """
        system_prompt: str = ""
        converted: List[Dict[str, str]] = []

        for msg in messages:
            role = msg.get("role", "user")
            content = str(msg.get("content", ""))
            if role == "system":
                system_prompt = (
                    f"{system_prompt}\n{content}" if system_prompt else content
                )
                continue

            anthropic_role = "assistant" if role == "assistant" else "user"
            converted.append({"role": anthropic_role, "content": content})

        return system_prompt, converted

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Anthropic Messages API 호출.

        Args:
            messages: role/content 형식의 메시지 리스트
            **kwargs: temperature, max_tokens 등 추가 옵션
        """
        system_prompt, converted_messages = self._convert_messages(messages)

        payload: Dict[str, Any] = {
            "model": self.model_id,
            "messages": converted_messages,
            "max_tokens": kwargs.pop("max_tokens", 1024),
        }
        if system_prompt:
            payload["system"] = system_prompt

        # 나머지 옵션(temperature 등)을 그대로 전달
        payload.update(kwargs)

        try:
            resp = requests.post(
                self.chat_url, headers=self._build_headers(), json=payload, timeout=10
            )
        except requests.RequestException as exc:
            raise ValueError(f"Anthropic 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(
                f"Anthropic 호출 실패 (status {resp.status_code}): {snippet}"
            )

        try:
            return resp.json()
        except ValueError as exc:
            raise ValueError("Anthropic 응답을 JSON으로 파싱할 수 없습니다.") from exc

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        간단한 토큰 수 추정치.
        - 토크나이저 의존성을 추가하지 않고 문자 길이 기반으로 계산
        - 최소 1 반환
        """
        total_chars = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_chars += len(str(role)) + len(str(content))

        # 대략 4문자 = 1토큰 정도로 가정
        return max(1, total_chars // 4)
