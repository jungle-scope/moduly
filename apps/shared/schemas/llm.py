import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, ConfigDict, Field

# === New Schemas ===

class LLMModelResponse(BaseModel):
    id: uuid.UUID
    model_id_for_api_call: str
    name: str
    type: str
    provider_name: str
    context_window: int
    input_price_1k: Optional[float] = None
    output_price_1k: Optional[float] = None
    is_active: bool
    model_metadata: Optional[Dict[str, Any]] = Field(default=None, serialization_alias="metadata")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class LLMProviderResponse(BaseModel):
    id: uuid.UUID
    name: str # e.g. openai
    description: Optional[str] = None
    type: str # system, custom
    base_url: Optional[str] = None
    auth_type: str
    doc_url: Optional[str] = None
    
    # Models provided by this provider
    models: List[LLMModelResponse] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)


class LLMCredentialCreate(BaseModel):
    """
    User credential creation request.
    Existing fields mapped to new schema:
    - alias -> credential_name
    - apiKey -> api_key (to be encrypted)
    """
    provider_id: uuid.UUID
    credential_name: str
    api_key: str = Field(..., description="Raw API Key")
    # For custom provider override if supported later, otherwise ignored/removed
    # base_url override could be added here if needed for custom generic providers
    
    model_config = ConfigDict(populate_by_name=True)


class LLMCredentialResponse(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    user_id: uuid.UUID
    credential_name: str
    config_preview: Optional[str] = None # sk-****
    is_valid: bool
    quota_type: str
    quota_limit: int
    quota_used: int
    created_at: datetime
    updated_at: datetime
    
    # We might want to show which provider it belongs to details?
    # provider_name: str (computed or from relation)

    model_config = ConfigDict(from_attributes=True)


class LLMUsageLogResponse(BaseModel):
    id: uuid.UUID
    prompt_tokens: int
    completion_tokens: int
    total_cost: Optional[float]
    latency_ms: Optional[int]
    status: str
    created_at: datetime
    
    
    model_config = ConfigDict(from_attributes=True)


class LLMModelPricingUpdate(BaseModel):
    input_price_1k: float
    output_price_1k: float
