from typing import Any, Dict, List

from .base import BaseLLMClient


class OpenAIClient(BaseLLMClient):
    """
    OpenAI 전용 LLM 클라이언트 스켈레톤.

    실제 SDK 호출/토큰 계산 로직은 추후 구현하세요.
    """

    def invoke(self, messages: List[Dict[str, Any]], **kwargs) -> Dict[str, Any]:
        # TODO: OpenAI SDK로 메시지 전송 후 응답 반환
        raise NotImplementedError("OpenAIClient.invoke is not implemented yet.")

    def get_num_tokens(self, messages: List[Dict[str, Any]]) -> int:
        # TODO: OpenAI 토크나이저로 메시지 토큰 수 계산
        raise NotImplementedError("OpenAIClient.get_num_tokens is not implemented yet.")
