"""
Anthropic(Claude)용 LLM 클라이언트.

Anthropic Messages API를 직접 호출합니다.
"""

from typing import Any, Dict, List

import requests

from .base import BaseLLMClient


class AnthropicClient(BaseLLMClient):
    """
    Anthropic Claude 클라이언트.

    credentials 예시:
    {
        "apiKey": "sk-ant-...",
        "baseUrl": "https://api.anthropic.com"
    }
    """

    # 현재 Anthropic API 버전
    ANTHROPIC_VERSION = "2023-06-01"

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        super().__init__(model_id=model_id, credentials=credentials)
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")
        if not self.api_key or not self.base_url:
            raise ValueError("Anthropic credentials에 apiKey/baseUrl가 필요합니다.")
        self.messages_url = self.base_url.rstrip("/") + "/v1/messages"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": self.ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }

    def embed(self, text: str) -> List[float]:
        """
        Anthropic은 임베딩 API를 제공하지 않습니다.
        """
        raise NotImplementedError(
            "Anthropic은 임베딩 API를 제공하지 않습니다. "
            "OpenAI 또는 Google의 임베딩 모델을 사용해주세요."
        )

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Anthropic Messages API 호출.

        Args:
            messages: role/content 형식의 메시지 리스트
            **kwargs: temperature, max_tokens 등 추가 옵션

        Returns:
            OpenAI 호환 형식으로 변환된 응답 JSON 딕셔너리

        Raises:
            ValueError: HTTP 에러/파싱 실패 시
        """
        # Anthropic API는 system 메시지를 별도 파라미터로 받음
        system_content = None
        user_messages = []
        
        for msg in messages:
            if msg.get("role") == "system":
                system_content = msg.get("content", "")
            else:
                user_messages.append(msg)

        payload: Dict[str, Any] = {
            "model": self.model_id,
            "messages": user_messages,
            "max_tokens": kwargs.pop("max_tokens", 4096),  # Anthropic은 max_tokens 필수
        }
        
        if system_content:
            payload["system"] = system_content
            
        # 나머지 옵션 추가 (temperature 등)
        payload.update(kwargs)

        try:
            resp = requests.post(
                self.messages_url, headers=self._build_headers(), json=payload, timeout=60
            )
        except requests.RequestException as exc:
            raise ValueError(f"Anthropic 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(f"Anthropic 호출 실패 (status {resp.status_code}): {snippet}")

        try:
            data = resp.json()
            # Anthropic 응답을 OpenAI 호환 형식으로 변환
            return self._convert_to_openai_format(data)
        except ValueError as exc:
            raise ValueError("Anthropic 응답을 JSON으로 파싱할 수 없습니다.") from exc

    def _convert_to_openai_format(self, anthropic_response: Dict[str, Any]) -> Dict[str, Any]:
        """
        Anthropic 응답을 OpenAI 호환 형식으로 변환합니다.
        
        Anthropic 형식:
        {
            "content": [{"type": "text", "text": "..."}],
            "usage": {"input_tokens": X, "output_tokens": Y}
        }
        
        OpenAI 형식:
        {
            "choices": [{"message": {"role": "assistant", "content": "..."}}],
            "usage": {"prompt_tokens": X, "completion_tokens": Y, "total_tokens": Z}
        }
        """
        # 컨텐츠 추출
        content_blocks = anthropic_response.get("content", [])
        text_content = ""
        for block in content_blocks:
            if block.get("type") == "text":
                text_content += block.get("text", "")

        # 사용량 변환
        usage = anthropic_response.get("usage", {})
        prompt_tokens = usage.get("input_tokens", 0)
        completion_tokens = usage.get("output_tokens", 0)

        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": text_content
                    },
                    "finish_reason": anthropic_response.get("stop_reason", "stop")
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }
        }

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        토큰 수 추정 (간단한 문자 기반 추정).

        Anthropic은 tiktoken을 지원하지 않으므로,
        대략적인 추정값을 반환합니다: 문자 수 / 4
        """
        total_chars = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_chars += len(role) + len(content)
        
        # 대략 4자당 1토큰으로 추정
        return max(1, total_chars // 4)
