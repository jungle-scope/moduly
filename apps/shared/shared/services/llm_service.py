import json
import uuid
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy.orm import Session, joinedload

from shared.db.models.llm import (
    LLMCredential,
    LLMModel,
    LLMProvider,
    LLMRelCredentialModel,
    LLMUsageLog,
)
from shared.schemas.llm import (
    LLMCredentialCreate,
    LLMCredentialResponse,
    LLMModelResponse,
    LLMProviderResponse,
)

from .llm_client.factory import get_llm_client


class LLMService:
    """
    LLM 공급자(Provider) 및 인증(Credential) 관리 서비스.
    새로운 아키텍처:
    - Provider는 시스템 정의 (전역)
    - Credential은 사용자 정의 (사용자별)
    """

    # 마이그레이션/개발용 플레이스홀더 유저 (인증 없음)
    PLACEHOLDER_USER_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")

    # 사용자 친화적인 모델 표시 이름
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

    # [NEW] 기본 가격 설정 (USD per 1M tokens -> 1K 단위 변환)
    # 가격 출처: https://openai.com/api/pricing/, https://anthropic.com/pricing
    # 아래 가격은 1K 토큰 기준입니다. (예: $5/1M -> 0.005/1K)
    KNOWN_MODEL_PRICES = {
        # ==================== OpenAI 채팅 모델 ====================
        # --- GPT-5 시리즈 (2025) ---
        "gpt-5": {"input": 0.005, "output": 0.015},
        "gpt-5-2025-08-07": {"input": 0.005, "output": 0.015},
        "gpt-5-pro": {"input": 0.015, "output": 0.060},
        "gpt-5-pro-2025-10-06": {"input": 0.015, "output": 0.060},
        "gpt-5-mini": {"input": 0.0003, "output": 0.0012},
        "gpt-5-mini-2025-08-07": {"input": 0.0003, "output": 0.0012},
        "gpt-5-nano": {"input": 0.0001, "output": 0.0004},
        "gpt-5-nano-2025-08-07": {"input": 0.0001, "output": 0.0004},
        "gpt-5-chat-latest": {"input": 0.005, "output": 0.015},
        "gpt-5-codex": {"input": 0.005, "output": 0.015},
        "gpt-5-search-api": {"input": 0.0025, "output": 0.010},
        "gpt-5-search-api-2025-10-14": {"input": 0.0025, "output": 0.010},
        # --- GPT-5.1 Series ---
        "gpt-5.1": {"input": 0.004, "output": 0.012},
        "gpt-5.1-2025-11-13": {"input": 0.004, "output": 0.012},
        "gpt-5.1-chat-latest": {"input": 0.004, "output": 0.012},
        "gpt-5.1-codex": {"input": 0.004, "output": 0.012},
        "gpt-5.1-codex-mini": {"input": 0.001, "output": 0.004},
        "gpt-5.1-codex-max": {"input": 0.010, "output": 0.040},
        # --- GPT-5.2 Series ---
        "gpt-5.2": {"input": 0.003, "output": 0.010},
        "gpt-5.2-2025-12-11": {"input": 0.003, "output": 0.010},
        "gpt-5.2-pro": {"input": 0.010, "output": 0.040},
        "gpt-5.2-pro-2025-12-11": {"input": 0.010, "output": 0.040},
        "gpt-5.2-chat-latest": {"input": 0.003, "output": 0.010},
        # --- GPT-4.1 Series (2025) ---
        "gpt-4.1": {"input": 0.002, "output": 0.008},
        "gpt-4.1-2025-04-14": {"input": 0.002, "output": 0.008},
        "gpt-4.1-mini": {"input": 0.0004, "output": 0.0016},
        "gpt-4.1-mini-2025-04-14": {"input": 0.0004, "output": 0.0016},
        "gpt-4.1-nano": {"input": 0.0001, "output": 0.0004},
        "gpt-4.1-nano-2025-04-14": {"input": 0.0001, "output": 0.0004},
        # --- GPT-4o Series ---
        "gpt-4o": {"input": 0.0025, "output": 0.010},
        "gpt-4o-2024-05-13": {"input": 0.005, "output": 0.015},
        "gpt-4o-2024-08-06": {"input": 0.0025, "output": 0.010},
        "gpt-4o-2024-11-20": {"input": 0.0025, "output": 0.010},
        "chatgpt-4o-latest": {"input": 0.005, "output": 0.015},
        # --- GPT-4o Mini Series ---
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-mini-2024-07-18": {"input": 0.00015, "output": 0.0006},
        # --- GPT-4o Search ---
        "gpt-4o-search-preview": {"input": 0.0025, "output": 0.010},
        "gpt-4o-search-preview-2025-03-11": {"input": 0.0025, "output": 0.010},
        "gpt-4o-mini-search-preview": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-mini-search-preview-2025-03-11": {"input": 0.00015, "output": 0.0006},
        # --- GPT-4o Audio/Realtime ---
        "gpt-4o-audio-preview": {"input": 0.0025, "output": 0.010},
        "gpt-4o-audio-preview-2024-12-17": {"input": 0.0025, "output": 0.010},
        "gpt-4o-audio-preview-2025-06-03": {"input": 0.0025, "output": 0.010},
        "gpt-4o-mini-audio-preview": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-mini-audio-preview-2024-12-17": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-realtime-preview": {"input": 0.005, "output": 0.020},
        "gpt-4o-realtime-preview-2024-12-17": {"input": 0.005, "output": 0.020},
        "gpt-4o-realtime-preview-2025-06-03": {"input": 0.005, "output": 0.020},
        "gpt-4o-mini-realtime-preview": {"input": 0.0006, "output": 0.0024},
        "gpt-4o-mini-realtime-preview-2024-12-17": {"input": 0.0006, "output": 0.0024},
        # --- GPT-4o Transcribe/TTS ---
        "gpt-4o-transcribe": {"input": 0.0025, "output": 0.0},
        "gpt-4o-transcribe-diarize": {"input": 0.004, "output": 0.0},
        "gpt-4o-mini-transcribe": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-transcribe-2025-03-20": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-transcribe-2025-12-15": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-tts": {"input": 0.0, "output": 0.0006},
        "gpt-4o-mini-tts-2025-03-20": {"input": 0.0, "output": 0.0006},
        "gpt-4o-mini-tts-2025-12-15": {"input": 0.0, "output": 0.0006},
        # --- Reasoning Models (O-Series) ---
        "o1": {"input": 0.015, "output": 0.060},
        "o1-2024-12-17": {"input": 0.015, "output": 0.060},
        "o1-pro": {"input": 0.150, "output": 0.600},
        "o1-pro-2025-03-19": {"input": 0.150, "output": 0.600},
        "o1-preview": {"input": 0.015, "output": 0.060},
        "o1-preview-2024-09-12": {"input": 0.015, "output": 0.060},
        "o1-mini": {"input": 0.003, "output": 0.012},
        "o1-mini-2024-09-12": {"input": 0.003, "output": 0.012},
        "o3": {"input": 0.010, "output": 0.040},
        "o3-2025-04-16": {"input": 0.010, "output": 0.040},
        "o3-mini": {"input": 0.0011, "output": 0.0044},
        "o3-mini-2025-01-31": {"input": 0.0011, "output": 0.0044},
        "o4-mini": {"input": 0.0011, "output": 0.0044},
        "o4-mini-2025-04-16": {"input": 0.0011, "output": 0.0044},
        # --- GPT-4 Turbo ---
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-2024-04-09": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-0125-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-1106-preview": {"input": 0.01, "output": 0.03},
        # --- GPT-4 Legacy ---
        "gpt-4": {"input": 0.03, "output": 0.06},
        "gpt-4-0613": {"input": 0.03, "output": 0.06},
        "gpt-4-0314": {"input": 0.03, "output": 0.06},
        # --- GPT-3.5 ---
        "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
        "gpt-3.5-turbo-0125": {"input": 0.0005, "output": 0.0015},
        "gpt-3.5-turbo-1106": {"input": 0.001, "output": 0.002},
        "gpt-3.5-turbo-16k": {"input": 0.003, "output": 0.004},
        "gpt-3.5-turbo-instruct": {"input": 0.0015, "output": 0.002},
        "gpt-3.5-turbo-instruct-0914": {"input": 0.0015, "output": 0.002},
        # --- GPT Audio/Realtime ---
        "gpt-audio": {"input": 0.005, "output": 0.020},
        "gpt-audio-2025-08-28": {"input": 0.005, "output": 0.020},
        "gpt-audio-mini": {"input": 0.0006, "output": 0.0024},
        "gpt-audio-mini-2025-10-06": {"input": 0.0006, "output": 0.0024},
        "gpt-audio-mini-2025-12-15": {"input": 0.0006, "output": 0.0024},
        "gpt-realtime": {"input": 0.005, "output": 0.020},
        "gpt-realtime-2025-08-28": {"input": 0.005, "output": 0.020},
        "gpt-realtime-mini": {"input": 0.0006, "output": 0.0024},
        "gpt-realtime-mini-2025-10-06": {"input": 0.0006, "output": 0.0024},
        "gpt-realtime-mini-2025-12-15": {"input": 0.0006, "output": 0.0024},
        # --- Legacy/Base Models ---
        "davinci-002": {"input": 0.002, "output": 0.002},
        "babbage-002": {"input": 0.0004, "output": 0.0004},
        # ==================== OpenAI 임베딩 모델 ====================
        "text-embedding-3-small": {"input": 0.00002, "output": 0.0},
        "text-embedding-3-large": {"input": 0.00013, "output": 0.0},
        "text-embedding-ada-002": {"input": 0.00010, "output": 0.0},
        # ==================== Anthropic 모델 ====================
        # --- Claude 3.5 Series ---
        "claude-3-5-opus": {"input": 0.015, "output": 0.075},  # $15 / $75
        "claude-3-5-opus-latest": {"input": 0.015, "output": 0.075},
        "claude-3-5-sonnet": {"input": 0.003, "output": 0.015},  # $3 / $15
        "claude-3-5-sonnet-latest": {"input": 0.003, "output": 0.015},
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
        "claude-3-5-sonnet-20240620": {"input": 0.003, "output": 0.015},
        "claude-3-5-haiku": {"input": 0.00025, "output": 0.00125},  # $0.25 / $1.25
        "claude-3-5-haiku-latest": {"input": 0.00025, "output": 0.00125},
        "claude-3-5-haiku-20241022": {"input": 0.00025, "output": 0.00125},
        # --- Claude 3 Series ---
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
        "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
        # --- Legacy ---
        "claude-2.1": {"input": 0.008, "output": 0.024},
        "claude-2.0": {"input": 0.008, "output": 0.024},
        "claude-instant-1.2": {"input": 0.0008, "output": 0.0024},
        # ==================== Google 모델 (2026 가격) ====================
        # 기본 가격 (128k context 이하). 128k 초과 시 가격 2배 (아직 미반영).
        # --- Gemini 3 Series ---
        "gemini-3-pro": {"input": 0.002, "output": 0.012},  # $2.00 / $12.00
        "gemini-3-flash": {"input": 0.0003, "output": 0.0025},  # $0.30 / $2.50
        # --- Gemini 1.5 Series ---
        "gemini-1.5-pro": {
            "input": 0.00125,
            "output": 0.010,
        },  # $1.25 / $10.00 (Updated)
        "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},  # $0.075 / $0.30
        "gemini-1.5-flash-8b": {
            "input": 0.0000375,
            "output": 0.00015,
        },  # $0.0375 / $0.15
        # --- Gemini 2.0 / Experimental ---
        "gemini-2.0-flash-exp": {"input": 0.0001, "output": 0.0004},
        # --- Legacy ---
        "gemini-1.0-pro": {"input": 0.0005, "output": 0.0015},
        # --- Embeddings ---
        "text-embedding-004": {"input": 0.000025, "output": 0.0},
    }

    @staticmethod
    def _mask_plain(value: str) -> str:
        if not value:
            return ""
        if len(value) <= 6:
            return "*" * len(value)
        return f"{value[:4]}****{value[-2:]}"

    @staticmethod
    def _fetch_remote_models(
        base_url: str, api_key: str, provider_type: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch available models from the provider API.
        Returns a list of raw model dicts from the provider.
        """
        remote_models = []
        remote_models = []

        provider = provider_type.lower()

        # Google supports OpenAI-compatible /models endpoint validation
        if provider in ["openai", "google"]:
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
                elif resp.status_code in [401, 403]:
                    # Explicitly raise error for auth failure
                    raise ValueError(
                        f"유효하지 않은 API Key입니다. 정확한 키를 입력했는지 확인해주세요. (Provider: {provider})"
                    )
                else:
                    # Treat other errors as failure during registration
                    raise ValueError(
                        f"Failed to fetch models from {provider}: {resp.status_code} {resp.text}"
                    )
            except ValueError:
                raise  # Re-raise known ValueErrors
            except Exception as e:
                # Catch network/timeout errors
                raise ValueError(f"Network error verifying {provider} key: {str(e)}")

        # Anthropic
        elif provider == "anthropic":
            url = base_url.rstrip("/") + "/models"
            try:
                resp = requests.get(
                    url,
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # Anthropic returns { "data": [ { "id": "claude-...", ... }, ... ] }
                    remote_models = data.get("data", [])
                elif resp.status_code in [401, 403]:
                    raise ValueError(
                        "유효하지 않은 API Key입니다. 정확한 키를 입력했는지 확인해주세요. (Provider: Anthropic)"
                    )
                else:
                    raise ValueError(
                        f"Failed to fetch models from Anthropic: {resp.status_code} {resp.text}"
                    )
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Network error verifying Anthropic key: {str(e)}")

        # LlamaParse
        elif provider == "llamaparse":
            # LlamaCloud API Validation (Check projects access)
            # base_url is typically https://api.cloud.llamaindex.ai
            url = base_url.rstrip("/") + "/api/v1/projects"
            try:
                resp = requests.get(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    # Authentication successful
                    # LlamaParse doesn't provide "models" for LLM nodes, so return empty
                    remote_models = []
                elif resp.status_code in [401, 403]:
                    raise ValueError(
                        "유효하지 않은 API Key입니다. 정확한 키를 입력했는지 확인해주세요. (Provider: LlamaParse)"
                    )
                else:
                    raise ValueError(
                        f"Failed to verify LlamaParse key: {resp.status_code} {resp.text}"
                    )
            except ValueError:
                raise
            except Exception as e:
                raise ValueError(f"Network error verifying LlamaParse key: {str(e)}")
        # For now, just return empty, but ideally we should validate if we support them.

        if not remote_models and provider in ["openai", "google", "anthropic"]:
            # If we got 200 OK but no models, that's suspicious but technically success.
            # However, usually there should be models.
            pass

        return remote_models

    @staticmethod
    def _sync_models_to_db(
        db: Session, provider: LLMProvider, remote_models: List[Dict[str, Any]]
    ) -> List[LLMModel]:
        """
        API에서 반환된 모델이 llm_models 테이블에 존재하는지 확인 및 동기화합니다.
        원격 모델에 해당하는 LLMModel 객체 리스트를 반환합니다.
        """
        synced_models = []
        existing_models = {
            m.model_id_for_api_call: m
            for m in db.query(LLMModel)
            .filter(LLMModel.provider_id == provider.id)
            .all()
        }

        for rm in remote_models:
            mid = rm.get("id")
            if not mid:
                continue

            # 표시 이름 결정 (Google의 경우 'models/' 접두사 제거)
            clean_id = mid.replace("models/", "")

            # 친화적인 이름 매핑이 있으면 적용, 없으면 ID 대문자화 등 사용
            display_name = LLMService.MODEL_DISPLAY_NAMES.get(clean_id, clean_id)

            # [NEW] 기본 가격 결정
            pricing = LLMService.KNOWN_MODEL_PRICES.get(clean_id)
            input_price = pricing["input"] if pricing else None
            output_price = pricing["output"] if pricing else None

            if mid in existing_models:
                # 메타데이터 및 이름 변경 시 업데이트
                model = existing_models[mid]
                changed = False
                if model.model_metadata != rm:
                    model.model_metadata = rm
                    changed = True
                if model.name != display_name:
                    model.name = display_name
                    changed = True

                # 가격 정보가 명시적으로 없고, 우리가 알고 있는 가격이 있다면 업데이트
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
                # 모델 ID 기반 모델 타입 감지
                mid_lower = mid.lower()
                m_type = "chat"  # 기본값

                # Embedding 모델
                if "embedding" in mid_lower:
                    m_type = "embedding"
                # Audio 모델 (TTS, Whisper, Audio)
                elif (
                    "tts" in mid_lower or "whisper" in mid_lower or "audio" in mid_lower
                ):
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

                # 동적 발견 시 기본 컨텍스트 윈도우는 알 수 없으므로, 안전한 기본값 또는 특정 규칙 사용
                ctx = 4096
                if "gpt-4" in mid:
                    ctx = 8192
                if "128k" in mid or "gpt-4o" in mid:
                    ctx = 128000

                new_model = LLMModel(
                    provider_id=provider.id,
                    model_id_for_api_call=mid,
                    name=display_name,  # Use cleaned name
                    type=m_type,
                    context_window=ctx,
                    is_active=True,
                    model_metadata=rm,
                    input_price_1k=input_price,  # [NEW]
                    output_price_1k=output_price,  # [NEW]
                )
                db.add(new_model)
                synced_models.append(new_model)

        db.flush()  # Flush to get IDs for new models
        return synced_models

    @staticmethod
    def get_system_providers(db: Session) -> List[LLMProviderResponse]:
        """List all system providers."""
        providers = db.query(LLMProvider).options(joinedload(LLMProvider.models)).all()
        return [LLMProviderResponse.model_validate(p) for p in providers]

    @staticmethod
    def get_user_credentials(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMCredentialResponse]:
        """List credentials for a user."""
        creds = db.query(LLMCredential).filter(LLMCredential.user_id == user_id).all()
        return [LLMCredentialResponse.model_validate(c) for c in creds]

    @staticmethod
    def register_credential(
        db: Session, user_id: uuid.UUID, request: LLMCredentialCreate
    ) -> LLMCredentialResponse:
        """
        Register a new credential for a user.
        Validates API Key with provider and syncs models.
        """
        # 1. Get Provider
        provider = (
            db.query(LLMProvider).filter(LLMProvider.id == request.provider_id).first()
        )
        if not provider:
            raise ValueError(f"Provider {request.provider_id} not found")

        # 2. Validate API Key (and fetch models)
        remote_models = LLMService._fetch_remote_models(
            provider.base_url, request.api_key, provider.name
        )

        # 3. Create Credential
        config_json = json.dumps(
            {"apiKey": request.api_key, "baseUrl": provider.base_url}
        )

        new_cred = LLMCredential(
            provider_id=provider.id,
            user_id=user_id,
            credential_name=request.credential_name,
            encrypted_config=config_json,
            is_valid=True,
            quota_type="unlimited",
            quota_limit=0,
            quota_used=0,
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
                is_verified=True,  # Validated via _fetch_remote_models
            )
            db.add(mapping)

        db.commit()
        db.refresh(new_cred)
        return LLMCredentialResponse.model_validate(new_cred)

    @staticmethod
    def delete_credential(
        db: Session, credential_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Delete a credential if it belongs to the user."""
        cred = (
            db.query(LLMCredential)
            .filter(LLMCredential.id == credential_id, LLMCredential.user_id == user_id)
            .first()
        )

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

        target_model = (
            db.query(LLMModel)
            .filter(LLMModel.model_id_for_api_call == model_id)
            .first()
        )
        if not target_model:
            # Model unknown to system? Fallback to findingANY user credential (openai default)
            # This is risky but compatible with "custom model name" inputs
            pass

        provider_id = target_model.provider_id if target_model else None

        query = db.query(LLMCredential).filter(
            LLMCredential.user_id == user_id, LLMCredential.is_valid == True
        )

        if provider_id:
            query = query.filter(LLMCredential.provider_id == provider_id)

        cred = query.first()

        if not cred:
            # Try placeholder user fallback if in dev mode validation
            if user_id != LLMService.PLACEHOLDER_USER_ID:
                return LLMService.get_client_for_user(
                    db, LLMService.PLACEHOLDER_USER_ID, model_id
                )

            raise ValueError(
                f"No valid credential found for user {user_id} (Model: {model_id})"
            )

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
            credentials={"apiKey": api_key, "baseUrl": base_url},
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
            raise ValueError(
                "No valid LLM credential found in system. Please register one via API."
            )

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
        provider_type = cred.provider.name  # e.g. openai

        target_model = model_id if model_id else "gpt-4o"

        return get_llm_client(
            provider=provider_type,
            model_id=target_model,
            credentials={"apiKey": api_key, "baseUrl": base_url},
        )

    @staticmethod
    def get_my_available_models(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMModelResponse]:
        """
        사용자의 등록된 Credential을 기반으로 사용 가능한 모든 모델을 반환합니다.
        Provider ID를 기준으로 조회하므로 별도의 연결 테이블 조인이 필요하지 않습니다.
        """
        # 1. 해당 사용자의 모든 유효한 Credential 조회
        user_creds = (
            db.query(LLMCredential)
            .filter(LLMCredential.user_id == user_id, LLMCredential.is_valid == True)
            .all()
        )

        if not user_creds:
            # 플레이스홀더 유저 Fallback
            if user_id != LLMService.PLACEHOLDER_USER_ID:
                return LLMService.get_my_available_models(
                    db, LLMService.PLACEHOLDER_USER_ID
                )
            return []

        # 2. Provider ID 추출
        provider_ids = list({c.provider_id for c in user_creds})

        # 3. 해당 Provider에 속한 모델 조회
        models = (
            db.query(LLMModel)
            .options(joinedload(LLMModel.provider))
            .filter(LLMModel.provider_id.in_(provider_ids), LLMModel.is_active == True)
            .order_by(LLMModel.name)
            .all()
        )

        return [LLMModelResponse.model_validate(m) for m in models]

    @staticmethod
    def get_my_embedding_models(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMModelResponse]:
        """
        사용자의 credential에 기반하여 사용 가능한 임베딩 모델 목록을 반환합니다.
        get_my_available_models와 동일하지만 type='embedding'으로 필터링됩니다.
        """
        # 1. 해당 사용자의 모든 유효한 credential 조회
        user_creds = (
            db.query(LLMCredential)
            .filter(LLMCredential.user_id == user_id, LLMCredential.is_valid == True)
            .all()
        )

        if not user_creds:
            # Placeholder 사용자로 fallback
            if user_id != LLMService.PLACEHOLDER_USER_ID:
                return LLMService.get_my_embedding_models(
                    db, LLMService.PLACEHOLDER_USER_ID
                )
            return []

        # 2. Provider ID 추출
        provider_ids = list({c.provider_id for c in user_creds})

        # 3. 해당 Provider의 임베딩 모델 조회
        models = (
            db.query(LLMModel)
            .options(joinedload(LLMModel.provider))
            .filter(
                LLMModel.provider_id.in_(provider_ids),
                LLMModel.is_active == True,
                LLMModel.type == "embedding",  # 임베딩 모델만
            )
            .distinct()
            .all()
        )

        return [LLMModelResponse.model_validate(m) for m in models]

    @staticmethod
    def _normalize_model_id(model_id: str) -> str:
        """
        모델 ID를 정규화하여 KNOWN_MODEL_PRICES와 매칭 가능하게 변환합니다.
        예: gpt-4o-2024-11-20 -> gpt-4o, claude-3-5-sonnet-20241022 -> claude-3-5-sonnet
        """
        import re

        # 1. Google prefix 제거
        clean = model_id.replace("models/", "")

        # 2. 날짜 suffix 패턴 제거
        # 패턴: -YYYY-MM-DD (예: gpt-4o-2024-11-20)
        clean = re.sub(r"-\d{4}-\d{2}-\d{2}$", "", clean)
        # 패턴: -YYYYMMDD (예: claude-3-5-sonnet-20241022)
        clean = re.sub(r"-\d{8}$", "", clean)

        return clean

    @staticmethod
    def calculate_cost(
        db: Session, model_id: str, prompt_tokens: int, completion_tokens: int
    ) -> float:
        """
        Calculate cost based on model pricing.
        Falls back to KNOWN_MODEL_PRICES if DB doesn't have pricing info.
        정규화된 모델 ID로 fallback 시도하여 버전 차이로 인한 매칭 실패 방지.
        """
        input_price = None
        output_price = None

        # 1. Try to get pricing from DB
        model = (
            db.query(LLMModel)
            .filter(LLMModel.model_id_for_api_call == model_id)
            .first()
        )

        if (
            model
            and model.input_price_1k is not None
            and model.output_price_1k is not None
        ):
            input_price = float(model.input_price_1k)
            output_price = float(model.output_price_1k)
            print(
                f"[calculate_cost] DB pricing found for '{model_id}': in={input_price}, out={output_price}"
            )
        else:
            # 2. Fallback to KNOWN_MODEL_PRICES (정규화된 ID로 시도)
            clean_id = model_id.replace("models/", "")  # Google prefix 제거
            pricing = LLMService.KNOWN_MODEL_PRICES.get(clean_id)

            # 정확한 매칭 실패 시, 정규화된 ID로 재시도
            if not pricing:
                normalized_id = LLMService._normalize_model_id(model_id)
                pricing = LLMService.KNOWN_MODEL_PRICES.get(normalized_id)
                if pricing:
                    print(
                        f"[calculate_cost] Normalized fallback for '{model_id}' -> '{normalized_id}': in={pricing['input']}, out={pricing['output']}"
                    )

            if pricing:
                input_price = pricing["input"]
                output_price = pricing["output"]
                if clean_id in LLMService.KNOWN_MODEL_PRICES:
                    print(
                        f"[calculate_cost] Fallback pricing for '{model_id}' (clean: '{clean_id}'): in={input_price}, out={output_price}"
                    )
            else:
                print(
                    f"[calculate_cost] NO PRICING FOUND for '{model_id}'. Tried: '{clean_id}', '{LLMService._normalize_model_id(model_id)}'"
                )

        # 3. If still no pricing, return 0
        if input_price is None or output_price is None:
            return 0.0

        # 4. Calculate
        input_cost = (prompt_tokens / 1000.0) * input_price
        output_cost = (completion_tokens / 1000.0) * output_price
        total = input_cost + output_cost

        return total

    @staticmethod
    def log_usage(
        db: Session,
        user_id: uuid.UUID,
        model_id: str,
        usage: Dict[str, Any],
        cost: float,
        workflow_run_id: Optional[uuid.UUID] = None,
        node_id: Optional[str] = None,
    ) -> LLMUsageLog:
        """
        Save LLM usage to database.
        """
        # Find model DB ID
        model = (
            db.query(LLMModel)
            .filter(LLMModel.model_id_for_api_call == model_id)
            .first()
        )

        log = LLMUsageLog(
            user_id=user_id,
            model_id=model.id if model else None,
            workflow_run_id=workflow_run_id,
            node_id=node_id,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_cost=cost,
            status="success",
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def update_model_pricing(
        db: Session, model_id: uuid.UUID, input_price: float, output_price: float
    ) -> LLMModel:
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
                current_in = (
                    float(m.input_price_1k) if m.input_price_1k is not None else -1.0
                )
                current_out = (
                    float(m.output_price_1k) if m.output_price_1k is not None else -1.0
                )

                target_in = pricing["input"]
                target_out = pricing["output"]

                if (
                    abs(current_in - target_in) > 0.0000001
                    or abs(current_out - target_out) > 0.0000001
                ):
                    m.input_price_1k = target_in
                    m.output_price_1k = target_out
                    updated_count += 1

        if updated_count > 0:
            db.commit()

        return {"updated_models": updated_count}
