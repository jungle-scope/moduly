"""
Google Gemini용 LLM 클라이언트.

- Google Generative Language API(v1beta) 규격에 맞춰 요청을 보냅니다.
- OpenAI/Anthropic와 동일한 인터페이스(BaseLLMClient)로 구현했습니다.
"""

from typing import Any, Dict, List, Tuple

import requests

from .base import BaseLLMClient


class GoogleClient(BaseLLMClient):
    """
    Google Gemini 클라이언트.

    credentials 예시:
    {
        "apiKey": "AIza...",
        "baseUrl": "https://generativelanguage.googleapis.com"
    }
    """

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        super().__init__(model_id=model_id, credentials=credentials)
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")

        if not self.api_key or not self.base_url:
            raise ValueError("Google Gemini credentials에 apiKey/baseUrl가 필요합니다.")

        # v1beta 경로 사용: /v1beta/models/{model}:generateContent
        self.endpoint = (
            self.base_url.rstrip("/")
            + f"/v1beta/models/{self.model_id}:generateContent"
        )

    def _convert_messages(
        self, messages: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        공통 포맷의 messages를 Gemini 포맷으로 변환합니다.
        - system 메시지는 system_instruction으로 합칩니다.
        - user/assistant는 user/model 역할로 매핑합니다.
        """
        contents: List[Dict[str, Any]] = []
        system_prompt = ""

        for msg in messages:
            role = msg.get("role", "user")
            content = str(msg.get("content", ""))

            if role == "system":
                system_prompt = f"{system_prompt}\n{content}" if system_prompt else content
                continue

            gemini_role = "model" if role == "assistant" else "user"
            contents.append({"role": gemini_role, "parts": [{"text": content}]})

        return contents, system_prompt

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Google Gemini Generate Content 호출.
        """
        contents, system_prompt = self._convert_messages(messages)

        payload: Dict[str, Any] = {"contents": contents}
        if system_prompt:
            payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

        # generationConfig에 들어갈 수 있는 주요 옵션만 추려서 전달
        gen_config_keys = ["temperature", "maxOutputTokens", "topP", "topK"]
        gen_config = {k: kwargs[k] for k in gen_config_keys if k in kwargs}
        if gen_config:
            payload["generationConfig"] = gen_config

        try:
            resp = requests.post(
                self.endpoint,
                params={"key": self.api_key},
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=10,
            )
        except requests.RequestException as exc:
            raise ValueError(f"Google Gemini 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(
                f"Google Gemini 호출 실패 (status {resp.status_code}): {snippet}"
            )

        try:
            return resp.json()
        except ValueError as exc:
            raise ValueError("Google Gemini 응답을 JSON으로 파싱할 수 없습니다.") from exc

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        간단한 토큰 수 추정치.
        - 문자 길이를 기준으로 대략 계산 (4문자 ≈ 1토큰 가정)
        """
        total_chars = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_chars += len(str(role)) + len(str(content))

        return max(1, total_chars // 4)
