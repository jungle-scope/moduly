"""
Google(Gemini)용 LLM 클라이언트.

Google Gemini API의 OpenAI 호환 엔드포인트를 사용합니다.
BaseLLMClient를 직접 상속하여 독립적인 구현을 제공합니다.
"""

from typing import Any, Dict, List

import requests

from .base import BaseLLMClient


class GoogleClient(BaseLLMClient):
    """
    Google Gemini 클라이언트.

    credentials 예시:
    {
        "apiKey": "AIza...",
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai"
    }
    """

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        # Google API에서 반환하는 모델 ID에는 'models/' 접두사가 붙어있지만,
        # OpenAI 호환 엔드포인트 호출 시에는 접두사 없이 호출해야 함
        if model_id.startswith("models/"):
            model_id = model_id.replace("models/", "")
            
        super().__init__(model_id=model_id, credentials=credentials)
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")
        if not self.api_key or not self.base_url:
            raise ValueError("Google Gemini credentials에 apiKey/baseUrl가 필요합니다.")
        self.chat_url = self.base_url.rstrip("/") + "/chat/completions"
        self.embedding_url = self.base_url.rstrip("/") + "/embeddings"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def embed(self, text: str) -> List[float]:
        """
        Google Gemini Embeddings API 호출.
        """
        payload = {"model": self.model_id, "input": text}

        try:
            resp = requests.post(
                self.embedding_url,
                headers=self._build_headers(),
                json=payload,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise ValueError(f"Google Gemini 임베딩 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            raise ValueError(
                f"Google Gemini 임베딩 호출 실패 (status {resp.status_code}): {resp.text[:200]}"
            )

        try:
            data = resp.json()
            # OpenAI 호환 형식: { "data": [ { "embedding": [...] } ] }
            return data["data"][0]["embedding"]
        except (ValueError, KeyError, IndexError) as exc:
            raise ValueError("Google Gemini 임베딩 응답 파싱 실패") from exc

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        Google Gemini Chat Completions 엔드포인트 호출 (OpenAI 호환).

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
        payload.update(kwargs)

        try:
            resp = requests.post(
                self.chat_url, headers=self._build_headers(), json=payload, timeout=60
            )
        except requests.RequestException as exc:
            raise ValueError(f"Google Gemini 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(f"Google Gemini 호출 실패 (status {resp.status_code}): {snippet}")

        try:
            return resp.json()
        except ValueError as exc:
            raise ValueError("Google Gemini 응답을 JSON으로 파싱할 수 없습니다.") from exc

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        토큰 수 추정 (간단한 문자 기반 추정).

        Google Gemini는 tiktoken을 지원하지 않으므로,
        대략적인 추정값을 반환합니다: 문자 수 / 4
        """
        total_chars = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_chars += len(role) + len(content)
        
        # 대략 4자당 1토큰으로 추정
        return max(1, total_chars // 4)
