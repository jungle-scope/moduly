import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class LLMProviderDebugCreate(BaseModel):
    """
    프론트엔드 연동 확인용: provider alias와 apiKey를 단순히 받아서 로깅.

    - populate_by_name=True 설정으로 camelCase(apiKey)와 snake_case(api_key) 모두 허용
    """

    alias: str
    api_key: str = Field(alias="apiKey")

    model_config = ConfigDict(populate_by_name=True)


class LLMProviderSimpleCreate(BaseModel):
    """
    최소 입력용 provider 생성 스키마.

    - alias: provider 이름/별칭 (DB의 provider_name으로 사용)
    - apiKey: credential로 저장할 키
    - provider_type: 예) "openai" (지금은 openai만 사용, 다른 provider는 TODO)
    - base_url, model: openai 규격에 필요한 최소 값
    - user_id: 없으면 내부 로직에서 임시 사용자(fallback) 사용
    """

    alias: str
    api_key: str = Field(alias="apiKey")
    provider_type: str = "openai"
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"
    user_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(populate_by_name=True)


class LLMCredentialCreate(BaseModel):
    """
    요청: 새 LLM 자격증명 추가

    - 어떤 provider에 붙는 키인지 (provider_id)
    - 누가 만들었는지 (user_id)
    - 사람이 알아보기 쉬운 이름과 암호화된 설정 값
    """

    provider_id: uuid.UUID
    user_id: uuid.UUID
    credential_name: str
    encrypted_config: str
    is_valid: bool = True


class LLMCredentialResponse(BaseModel):
    """
    응답: LLM 자격증명 정보

    - DB에서 꺼낸 credential 상세 정보
    - created_at / updated_at 포함
    """

    id: uuid.UUID
    provider_id: uuid.UUID
    user_id: uuid.UUID
    credential_name: str
    encrypted_config: str
    is_valid: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True  # SQLAlchemy 모델을 Pydantic 모델로 자동 변환 허용


class LLMProviderCreate(BaseModel):
    """
    요청: 새 LLM provider 추가

    - 누가 소유하는지 (user_id)
    - 제공자 이름/타입, 기본 credential_id, quota 설정
    - 기본값을 줘서 필수 입력을 줄임
    """

    user_id: uuid.UUID
    provider_name: str
    provider_type: str = "custom"
    credential_id: Optional[uuid.UUID] = None
    quota_type: str = "none"
    quota_limit: int = -1
    quota_used: int = 0
    is_valid: bool = True


class LLMProviderResponse(BaseModel):
    """
    응답: LLM provider 정보 및 자격증명 목록

    - provider 기본 정보 + 기본 credential_id
    - credentials 배열로 연결된 credential 응답 포함
    """

    id: uuid.UUID
    user_id: uuid.UUID
    provider_name: str
    provider_type: str
    credential_id: Optional[uuid.UUID]
    quota_type: str
    quota_limit: int
    quota_used: int
    is_valid: bool
    created_at: datetime
    updated_at: datetime
    credentials: List[LLMCredentialResponse] = Field(default_factory=list)

    class Config:
        orm_mode = True  # SQLAlchemy 모델을 Pydantic 모델로 자동 변환 허용
