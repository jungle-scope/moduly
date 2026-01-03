"""
OpenAI용 LLM 클라이언트.

실제 SDK 대신 HTTP 호출로 동작하며, 응답/에러를 단순 래핑합니다.
"""

from typing import Any, Dict, List

import requests
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

    def __init__(self, model_id: str, credentials: Dict[str, Any]):
        super().__init__(model_id=model_id, credentials=credentials)
        self.api_key = credentials.get("apiKey") or credentials.get("api_key")
        self.base_url = credentials.get("baseUrl") or credentials.get("base_url")
        if not self.api_key or not self.base_url:
            raise ValueError("OpenAI credentials에 apiKey/baseUrl가 필요합니다.")
        self.chat_url = self.base_url.rstrip("/") + "/chat/completions"
        self.embedding_url = self.base_url.rstrip("/") + "/embeddings"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def embed(self, text: str) -> List[float]:
        """
        OpenAI Embeddings API 호출.
        """
        payload = {
            "model": self.model_id,
            "input": text
        }
        
        try:
            resp = requests.post(
                self.embedding_url, 
                headers=self._build_headers(), 
                json=payload, 
                timeout=30
            )
        except requests.RequestException as exc:
            raise ValueError(f"OpenAI 임베딩 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
             raise ValueError(f"OpenAI 임베딩 호출 실패 (status {resp.status_code}): {resp.text[:200]}")

        try:
            data = resp.json()
            # OpenAI response format: { "data": [ { "embedding": [...] } ] }
            return data["data"][0]["embedding"]
        except (ValueError, KeyError, IndexError) as exc:
             raise ValueError("OpenAI 임베딩 응답 파싱 실패") from exc

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        """
        OpenAI Chat Completions 엔드포인트 호출.

        Args:
            messages: role/content 형식의 메시지 리스트
            **kwargs: temperature, max_tokens 등 추가 옵션

        Returns:
            OpenAI 응답 JSON 딕셔너리

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
            raise ValueError(f"OpenAI 호출 실패: {exc}") from exc

        if resp.status_code >= 400:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(f"OpenAI 호출 실패 (status {resp.status_code}): {snippet}")

        try:
            return resp.json()
        except ValueError as exc:
            raise ValueError("OpenAI 응답을 JSON으로 파싱할 수 없습니다.") from exc

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """
        OpenAI tokenizer(tiktoken) 기반 토큰 수 계산.

        제약/주의:
        - tiktoken이 지원하지 않는 모델명은 cl100k_base로 fallback
        - messages는 role/content 키를 포함한 dict 리스트여야 함
        - 반환값은 최소 1
        """
        try:
            enc = tiktoken.encoding_for_model(self.model_id)
        except Exception:
            enc = tiktoken.get_encoding("cl100k_base")

        total_tokens = 0
        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")
            total_tokens += len(enc.encode(role))
            total_tokens += len(enc.encode(content))

        return max(1, total_tokens)
