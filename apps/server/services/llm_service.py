import json
import uuid
from typing import List, Optional, Dict, Any

import requests
from sqlalchemy.orm import Session, joinedload

from db.models.llm import (
    LLMProvider, 
    LLMCredential, 
    LLMModel, 
    LLMUsageLog, 
    LLMRelCredentialModel
)
from db.models.user import User
from schemas.llm import (
    LLMCredentialCreate,
    LLMCredentialResponse,
    LLMProviderResponse,
    LLMModelResponse
)
from services.llm_client.factory import get_llm_client


class LLMService:
    """
    LLM Provider & Credential Management Service.
    New Architecture:
    - Providers are System-defined (Global).
    - Credentials are User-defined (Per User).
    """

    # Placeholder user for migration/dev without auth
    PLACEHOLDER_USER_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")

    # Pre-defined friendly names for common models
    MODEL_DISPLAY_NAMES = {
        "gpt-4o": "GPT-4o (Omni)",
        "gpt-4o-mini": "GPT-4o Mini",
        "gpt-4-turbo": "GPT-4 Turbo",
        "gpt-4": "GPT-4 (Legacy)",
        "gpt-3.5-turbo": "GPT-3.5 Turbo",
        "gemini-1.5-flash": "Gemini 1.5 Flash",
        "gemini-1.5-pro": "Gemini 1.5 Pro",
        "gemini-2.0-flash-exp": "Gemini 2.0 Flash (Exp)",
        "gemini-pro": "Gemini Pro (1.0)",
        "claude-3-5-sonnet-20240620": "Claude 3.5 Sonnet",
        "claude-3-opus-20240229": "Claude 3 Opus",
        "claude-3-sonnet-20240229": "Claude 3 Sonnet",
        "claude-3-haiku-20240307": "Claude 3 Haiku",
    }

    # [NEW] Default Pricing Configuration (USD per 1M tokens -> convert to 1K)
    # Pricing reference: https://openai.com/api/pricing/, https://anthropic.com/pricing
    # Prices below are per 1K tokens.
    # [NEW] Default Pricing Configuration (USD per 1M tokens -> convert to 1K)
    # Pricing reference: https://openai.com/api/pricing/, https://anthropic.com/pricing
    # Prices below are per 1K tokens. (ex: $5/1M -> 0.005/1K)
    KNOWN_MODEL_PRICES = {
        # --- OpenAI (Chat) ---
        "gpt-4o": {"input": 0.0025, "output": 0.010}, 
        "gpt-4o-2024-08-06": {"input": 0.0025, "output": 0.010},
        "gpt-4o-2024-05-13": {"input": 0.005, "output": 0.015},
        
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006}, 
        "gpt-4o-mini-2024-07-18": {"input": 0.00015, "output": 0.0006},
        
        "o1-preview": {"input": 0.015, "output": 0.060}, 
        "o1-preview-2024-09-12": {"input": 0.015, "output": 0.060},
        "o1-mini": {"input": 0.003, "output": 0.012}, 
        "o1-mini-2024-09-12": {"input": 0.003, "output": 0.012},
        
        "gpt-4-turbo": {"input": 0.01, "output": 0.03}, 
        "gpt-4-turbo-2024-04-09": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-0125-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-1106-preview": {"input": 0.01, "output": 0.03},
        
        "gpt-4": {"input": 0.03, "output": 0.06}, 
        "gpt-4-0613": {"input": 0.03, "output": 0.06},
        "gpt-4-0314": {"input": 0.03, "output": 0.06},
        
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015}, 
        "gpt-3.5-turbo-0125": {"input": 0.0005, "output": 0.0015},
        "gpt-3.5-turbo-1106": {"input": 0.001, "output": 0.002},
        
        # --- OpenAI (Embedding) ---
        "text-embedding-3-small": {"input": 0.00002, "output": 0.0}, # $0.02 / 1M
        "text-embedding-3-large": {"input": 0.00013, "output": 0.0}, # $0.13 / 1M
        "text-embedding-ada-002": {"input": 0.00010, "output": 0.0}, # $0.10 / 1M
        
        # --- Anthropic ---
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015}, # v2
        "claude-3-5-sonnet-20240620": {"input": 0.003, "output": 0.015}, 
        
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075}, 
        "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015}, 
        "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125}, 
        
        "claude-2.1": {"input": 0.008, "output": 0.024},
        "claude-2.0": {"input": 0.008, "output": 0.024},
        "claude-instant-1.2": {"input": 0.0008, "output": 0.0024},
        
        # --- Google ---
        # Note: Google prices change frequently and have free tier limits.
        "gemini-1.5-pro": {"input": 0.0035, "output": 0.0105}, # $3.50 / $10.50 (<128k)
        "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003}, 
        "gemini-1.5-flash-8b": {"input": 0.0000375, "output": 0.00015},
        "gemini-1.0-pro": {"input": 0.0005, "output": 0.0015}, 
        "text-embedding-004": {"input": 0.000025, "output": 0.0},
    }

    @staticmethod
    def _mask_plain(value: str) -> str:
        if not value: return ""
        if len(value) <= 6: return "*" * len(value)
        return f"{value[:4]}****{value[-2:]}"

    @staticmethod
    def _fetch_remote_models(base_url: str, api_key: str, provider_type: str) -> List[Dict[str, Any]]:
        """
        Fetch available models from the provider API.
        Returns a list of raw model dicts from the provider.
        """
        remote_models = []
        # Google supports OpenAI-compatible /models endpoint validation
        if provider_type.lower() in ["openai", "google"]:
            url = base_url.rstrip("/") + "/models"
            try:
                resp = requests.get(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # OpenAI returns { "data": [ { "id": "model-id", ... }, ... ] }
                    remote_models = data.get("data", [])
                else:
                    # Log warning but don't fail registration
                    print(f"[Warning] Failed to fetch models: {resp.status_code} {resp.text}")
            except Exception as e:
                print(f"[Warning] Failed to fetch models (Network): {e}")
        
        return remote_models

    @staticmethod
    def _sync_models_to_db(db: Session, provider: LLMProvider, remote_models: List[Dict[str, Any]]) -> List[LLMModel]:
        """
        Ensure models returned by API exist in llm_models table.
        Returns the list of LLMModel objects corresponding to the remote models.
        """
        synced_models = []
        existing_models = {
            m.model_id_for_api_call: m 
            for m in db.query(LLMModel).filter(LLMModel.provider_id == provider.id).all()
        }

        for rm in remote_models:
            mid = rm.get("id")
            if not mid: continue
            
            # Determine display name (strip 'models/' prefix for Google)
            clean_id = mid.replace("models/", "")
            
            # Apply friendly mapping if available, otherwise use capitalized ID
            display_name = LLMService.MODEL_DISPLAY_NAMES.get(clean_id, clean_id)
            
            # [NEW] Determine Default Pricing
            pricing = LLMService.KNOWN_MODEL_PRICES.get(clean_id)
            input_price = pricing["input"] if pricing else None
            output_price = pricing["output"] if pricing else None

            if mid in existing_models:
                # Update metadata and name if changed
                model = existing_models[mid]
                changed = False
                if model.model_metadata != rm:
                    model.model_metadata = rm
                    changed = True
                if model.name != display_name:
                    model.name = display_name
                    changed = True
                
                # Update pricing if explicitly missing and we have knowledge
                if model.input_price_1k is None and input_price is not None:
                    model.input_price_1k = input_price
                    changed = True
                if model.output_price_1k is None and output_price is not None:
                    model.output_price_1k = output_price
                    changed = True
                
                if changed:
                    db.add(model)
                synced_models.append(model)
            else:
                # Create new model
                # Model type detection based on model ID
                mid_lower = mid.lower()
                m_type = "chat"  # 기본값
                
                # Embedding 모델
                if "embedding" in mid_lower:
                    m_type = "embedding"
                # Audio 모델 (TTS, Whisper, Audio)
                elif "tts" in mid_lower or "whisper" in mid_lower or "audio" in mid_lower:
                    m_type = "audio"
                # Image 생성 모델
                elif "dall-e" in mid_lower or "image" in mid_lower:
                    m_type = "image"
                # Realtime 모델
                elif "realtime" in mid_lower:
                    m_type = "realtime"
                # Moderation 모델
                elif "moderation" in mid_lower:
                    m_type = "moderation"
                # Chat 모델 (gpt, o1, o3, claude, gemini 등)
                # else: 기본값 "chat" 유지
                
                # Default context window is unknown for dynamic discovery, set safe default or specific rules
                ctx = 4096
                if "gpt-4" in mid: ctx = 8192
                if "128k" in mid or "gpt-4o" in mid: ctx = 128000
                
                new_model = LLMModel(
                    provider_id=provider.id,
                    model_id_for_api_call=mid,
                    name=display_name, # Use cleaned name
                    type=m_type,
                    context_window=ctx,
                    is_active=True,
                    model_metadata=rm,
                    input_price_1k=input_price, # [NEW]
                    output_price_1k=output_price # [NEW]
                )
                db.add(new_model)
                synced_models.append(new_model)
        
        db.flush() # Flush to get IDs for new models
        return synced_models


    @staticmethod
    def get_system_providers(db: Session) -> List[LLMProviderResponse]:
        """List all system providers."""
        providers = db.query(LLMProvider).options(joinedload(LLMProvider.models)).all()
        return [LLMProviderResponse.model_validate(p) for p in providers]

    @staticmethod
    def get_user_credentials(db: Session, user_id: uuid.UUID) -> List[LLMCredentialResponse]:
        """List credentials for a user."""
        creds = db.query(LLMCredential).filter(
            LLMCredential.user_id == user_id
        ).all()
        return [LLMCredentialResponse.model_validate(c) for c in creds]

    @staticmethod
    def register_credential(db: Session, user_id: uuid.UUID, request: LLMCredentialCreate) -> LLMCredentialResponse:
        """
        Register a new credential for a user.
        Validates API Key with provider and syncs models.
        """
        # 1. Get Provider
        provider = db.query(LLMProvider).filter(LLMProvider.id == request.provider_id).first()
        if not provider:
            raise ValueError(f"Provider {request.provider_id} not found")
        
        # 2. Validate API Key (and fetch models)
        remote_models = LLMService._fetch_remote_models(provider.base_url, request.api_key, provider.name)
        
        # 3. Create Credential
        config_json = json.dumps({
            "apiKey": request.api_key,
            "baseUrl": provider.base_url 
        })
        
        new_cred = LLMCredential(
            provider_id=provider.id,
            user_id=user_id,
            credential_name=request.credential_name,
            encrypted_config=config_json,
            is_valid=True,
            quota_type="unlimited",
            quota_limit=0,
            quota_used=0
        )
        db.add(new_cred)
        db.flush() 
        
        # 4. Sync Models to DB
        db_models = LLMService._sync_models_to_db(db, provider, remote_models)
        
        # 5. Map Credential to Models
        for m in db_models:
            # Check if mapping exists? (Unlikely for new cred)
            mapping = LLMRelCredentialModel(
                credential_id=new_cred.id,
                model_id=m.id,
                is_verified=True # Validated via _fetch_remote_models
            )
            db.add(mapping)
            
        db.commit()
        db.refresh(new_cred)
        return LLMCredentialResponse.model_validate(new_cred)

    @staticmethod
    def delete_credential(db: Session, credential_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Delete a credential if it belongs to the user."""
        cred = db.query(LLMCredential).filter(
            LLMCredential.id == credential_id,
            LLMCredential.user_id == user_id
        ).first()
        
        if not cred:
            return False
            
        db.delete(cred)
        db.commit()
        return True


    @staticmethod
    def get_client_for_user(db: Session, user_id: uuid.UUID, model_id: str):
        """
        Find a valid credential for the user that supports the given model_id.
        Priority:
        1. Check llm_rel_credential_models for explicit permission (TODO)
        2. Fallback: Use any valid credential for the provider that owns this model_id.
        """
        # TODO: Add tenant_id support later when Tenant schema is introduced.
        # This method currently only filters by user_id.

        # 1. Find the model to know the provider
        # Note: model_id string might be 'gpt-4o' which is common.
        # But if we have multiple providers offering same model name (rare but possible), we might need more info.
        # Assuming model names are unique enough or we pick system provider preference.
        
        target_model = db.query(LLMModel).filter(LLMModel.model_id_for_api_call == model_id).first()
        if not target_model:
             # Model unknown to system? Fallback to findingANY user credential (openai default)
             # This is risky but compatible with "custom model name" inputs
             pass

        provider_id = target_model.provider_id if target_model else None

        query = db.query(LLMCredential).filter(
            LLMCredential.user_id == user_id,
            LLMCredential.is_valid == True
        )
        
        if provider_id:
            query = query.filter(LLMCredential.provider_id == provider_id)
        
        cred = query.first()
        
        if not cred:
             # Try placeholder user fallback if in dev mode validation
             if user_id != LLMService.PLACEHOLDER_USER_ID:
                 return LLMService.get_client_for_user(db, LLMService.PLACEHOLDER_USER_ID, model_id)
                 
             raise ValueError(f"No valid credential found for user {user_id} (Model: {model_id})")

        # Load config
        try:
            cfg = json.loads(cred.encrypted_config)
            api_key = cfg.get("apiKey")
            base_url = cfg.get("baseUrl")
        except:
             raise ValueError("Invalid credential config")

        db.refresh(cred) 
        provider_type = cred.provider.name

        return get_llm_client(
            provider=provider_type,
            model_id=model_id,
            credentials={"apiKey": api_key, "baseUrl": base_url}
        )

    @staticmethod
    def get_client_with_any_credential(db: Session, model_id: Optional[str] = None):
        """
        [DEPRECATED] Compatibility/Dev Mode: Get a client using the first available credential.
        Used by LLMNode if user_id is not available.
        TODO: Remove this method once all workflows are running with valid user context.
        """
        # 1. Find any valid credential
        cred = db.query(LLMCredential).filter(LLMCredential.is_valid == True).first()
        if not cred:
            raise ValueError("No valid LLM credential found in system. Please register one via API.")
        
        # 2. Get config
        try:
            cfg = json.loads(cred.encrypted_config)
            api_key = cfg.get("apiKey")
            base_url = cfg.get("baseUrl")
        except:
             raise ValueError("Invalid credential config")
        
        # 3. Determine Provider & Model
        # Load provider to get type
        db.refresh(cred)
        provider_type = cred.provider.name # e.g. openai

        target_model = model_id if model_id else "gpt-4o"

        return get_llm_client(
            provider=provider_type,
            model_id=target_model,
            credentials={"apiKey": api_key, "baseUrl": base_url}
        )
    @staticmethod
    def get_my_available_models(db: Session, user_id: uuid.UUID) -> List[LLMModelResponse]:
        """
        Get all models available to the user based on their registered credentials.
        Joins LLMRelCredentialModel -> LLMCredential -> User to find models.
        """
        # 1. Find all credential IDs for this user
        user_creds = db.query(LLMCredential.id).filter(
            LLMCredential.user_id == user_id,
            LLMCredential.is_valid == True
        ).all()
        cred_ids = [c.id for c in user_creds]
        
        if not cred_ids:
            # Fallback if placebo user
            if user_id != LLMService.PLACEHOLDER_USER_ID:
                 return LLMService.get_my_available_models(db, LLMService.PLACEHOLDER_USER_ID)
            return []

        # 2. Find models mapped to these credentials
        # Join LLMRelCredentialModel -> LLMModel
        models = db.query(LLMModel).join(
            LLMRelCredentialModel, LLMModel.id == LLMRelCredentialModel.model_id
        ).options(
            joinedload(LLMModel.provider)
        ).filter(
            LLMRelCredentialModel.credential_id.in_(cred_ids),
            LLMModel.is_active == True
        ).distinct().all()
        
        return [LLMModelResponse.model_validate(m) for m in models]

    @staticmethod
    def get_my_embedding_models(db: Session, user_id: uuid.UUID) -> List[LLMModelResponse]:
        """
        사용자의 credential에 기반하여 사용 가능한 임베딩 모델 목록을 반환합니다.
        get_my_available_models와 동일하지만 type='embedding'으로 필터링됩니다.
        """
        # 1. 해당 사용자의 모든 credential ID 조회
        user_creds = db.query(LLMCredential.id).filter(
            LLMCredential.user_id == user_id,
            LLMCredential.is_valid == True
        ).all()
        cred_ids = [c.id for c in user_creds]
        
        if not cred_ids:
            # Placeholder 사용자로 fallback
            if user_id != LLMService.PLACEHOLDER_USER_ID:
                 return LLMService.get_my_embedding_models(db, LLMService.PLACEHOLDER_USER_ID)
            return []

        # 2. 해당 credential에 매핑된 임베딩 모델 조회
        models = db.query(LLMModel).join(
            LLMRelCredentialModel, LLMModel.id == LLMRelCredentialModel.model_id
        ).options(
            joinedload(LLMModel.provider)
        ).filter(
            LLMRelCredentialModel.credential_id.in_(cred_ids),
            LLMModel.is_active == True,
            LLMModel.type == "embedding"  # 임베딩 모델만
        ).distinct().all()
        
        return [LLMModelResponse.model_validate(m) for m in models]

    @staticmethod
    def calculate_cost(db: Session, model_id: str, prompt_tokens: int, completion_tokens: int) -> float:
        """
        Calculate cost based on model pricing.
        """
        # 1. Find the model to get pricing
        # Note: model_id might be "gpt-4o" (model_id_for_api_call)
        model = db.query(LLMModel).filter(LLMModel.model_id_for_api_call == model_id).first()
        
        if not model or model.input_price_1k is None or model.output_price_1k is None:
            return 0.0

        # 2. Calculate
        input_cost = (prompt_tokens / 1000.0) * float(model.input_price_1k)
        output_cost = (completion_tokens / 1000.0) * float(model.output_price_1k)
        
        return input_cost + output_cost

    @staticmethod
    def log_usage(
        db: Session,
        user_id: uuid.UUID,
        model_id: str,
        usage: Dict[str, Any],
        cost: float,
        workflow_run_id: Optional[uuid.UUID] = None,
        node_id: Optional[str] = None
    ) -> LLMUsageLog:
        """
        Save LLM usage to database.
        """
        # Find model DB ID
        model = db.query(LLMModel).filter(LLMModel.model_id_for_api_call == model_id).first()
        
        log = LLMUsageLog(
            user_id=user_id,
            model_id=model.id if model else None,
            workflow_run_id=workflow_run_id,
            node_id=node_id,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_cost=cost,
            status="success"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_model_pricing(db: Session, model_id: uuid.UUID, input_price: float, output_price: float) -> LLMModel:
        """
        Update pricing for a specific model.
        """
        model = db.query(LLMModel).filter(LLMModel.id == model_id).first()
        if not model:
            raise ValueError(f"Model {model_id} not found")
            
        model.input_price_1k = input_price
        model.output_price_1k = output_price
        db.commit()
        db.refresh(model)
        return model

    @staticmethod
    def sync_system_prices(db: Session) -> Dict[str, Any]:
        """
        Sync ALL existing models in DB with KNOWN_MODEL_PRICES.
        Overrides existing prices if a match is found in the known list.
        """
        updated_count = 0
        known_prices = LLMService.KNOWN_MODEL_PRICES
        
        models = db.query(LLMModel).all()
        for m in models:
            # Match by model_id_for_api_call (e.g. gpt-4o)
            # Also handle if ID has "models/" prefix (Google)
            clean_id = m.model_id_for_api_call.replace("models/", "")
            
            pricing = known_prices.get(clean_id)
            if pricing:
                # Update if different (or if previously None)
                # Comparing floats roughly
                current_in = float(m.input_price_1k) if m.input_price_1k is not None else -1.0
                current_out = float(m.output_price_1k) if m.output_price_1k is not None else -1.0
                
                target_in = pricing["input"]
                target_out = pricing["output"]
                
                if abs(current_in - target_in) > 0.0000001 or abs(current_out - target_out) > 0.0000001:
                    m.input_price_1k = target_in
                    m.output_price_1k = target_out
                    updated_count += 1
        
        if updated_count > 0:
            db.commit()
            
        return {"updated_models": updated_count}
