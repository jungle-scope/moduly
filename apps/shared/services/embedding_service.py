import json
from typing import List
from uuid import UUID

import openai
from apps.shared.db.models.llm import LLMCredential, LLMProvider
from apps.shared.utils.encryption import encryption_manager
from sqlalchemy.orm import Session


class EmbeddingService:
    """
    [Shared] 임베딩 전용 서비스
    Gateway LLMService에 의존하지 않고, 직접 OpenAI 임베딩을 수행합니다.
    """

    def __init__(self, db: Session, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self._client = None
        self._model = "text-embedding-3-small"  # Default

    def _get_client(self):
        if self._client:
            return self._client

        # 1. 사용자의 OpenAI 크리덴셜 조회 (우선순위: Provider Name = 'openai')
        credential = (
            self.db.query(LLMCredential)
            .join(LLMProvider)
            .filter(
                LLMCredential.user_id == self.user_id,
                LLMCredential.is_valid,
                LLMProvider.name == "openai",
            )
            .first()
        )

        if not credential:
            # Fallback: 아무 유효한 크리덴셜이나 사용 (개발/테스트용)
            credential = (
                self.db.query(LLMCredential)
                .filter(
                    LLMCredential.user_id == self.user_id,
                    LLMCredential.is_valid,
                )
                .first()
            )

        if not credential:
            raise ValueError(f"No valid LLM credential found for user {self.user_id}")

        # 2. API Key 복호화
        try:
            config_str = credential.encrypted_config
            # TODO: 실제로는 DB에 암호화되어 저장되지만, 현재 개발환경에서 평문일 수도 있음
            # encryption_manager를 통해 복호화 시도
            try:
                config_json = encryption_manager.decrypt(config_str)
            except Exception:
                config_json = config_str

            config = json.loads(config_json)
            api_key = config.get("apiKey")
            if not api_key:
                raise ValueError("API Key missing in credential config")

            self._client = openai.OpenAI(api_key=api_key)
            return self._client
        except Exception as e:
            raise ValueError(f"Failed to initialize OpenAI client: {e}")

    def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        """
        텍스트 배치를 임베딩 벡터로 변환 (OpenAI)
        """
        client = self._get_client()
        target_model = model or self._model

        # 빈 텍스트 처리 (OpenAI 에러 방지)
        clean_texts = [t if t and t.strip() else " " for t in texts]

        try:
            response = client.embeddings.create(input=clean_texts, model=target_model)
            # 순서 보장
            embeddings = [data.embedding for data in response.data]
            return embeddings
        except Exception as e:
            print(f"[EmbeddingService] Failed: {e}")
            # 실패 시 더미 벡터 (0.0) 반환 or Raise
            # 여기서는 Workflow가 멈추지 않도록 Raise하되 상위에서 처리
            raise e
