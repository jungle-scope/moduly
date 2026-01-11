"""
Database seed helpers for startup.

- Seeds a placeholder user for local/dev
- Seeds system LLM providers (idempotent)
"""

import uuid
from typing import Iterable

from sqlalchemy.orm import Session

from shared.db.models.llm import LLMProvider
from shared.db.models.user import User


PLACEHOLDER_USER_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")


def seed_placeholder_user(db: Session) -> None:
    """Ensure the dev placeholder user exists."""
    user = db.query(User).filter(User.id == PLACEHOLDER_USER_ID).first()
    if user:
        return

    dev_user = User(
        id=PLACEHOLDER_USER_ID,
        email="dev@moduly.app",
        name="Dev User",
        password="dev-password",
    )
    db.add(dev_user)
    db.commit()
    print("✅ Placeholder user created!")


def _default_providers() -> Iterable[LLMProvider]:
    """Return the default LLM provider rows to seed."""
    return [
        LLMProvider(
            name="openai",
            description="OpenAI default provider",
            base_url="https://api.openai.com/v1",
            type="system",
            auth_type="api_key",
            doc_url="https://platform.openai.com/api-keys",
        ),
        LLMProvider(
            name="anthropic",
            description="Anthropic Claude provider",
            base_url="https://api.anthropic.com/v1",
            type="system",
            auth_type="api_key",
            doc_url="https://console.anthropic.com/settings/keys",
        ),
        LLMProvider(
            name="google",
            description="Google Gemini provider",
            base_url="https://generativelanguage.googleapis.com/v1beta/openai",
            type="system",
            auth_type="api_key",
            doc_url="https://aistudio.google.com/",
        ),
        LLMProvider(
            name="llamaparse",
            description="LlamaParse high-quality document parser (LlamaIndex Cloud)",
            base_url="https://api.cloud.llamaindex.ai",
            type="system",
            auth_type="api_key",
            doc_url="https://cloud.llamaindex.ai/api-key",
        ),
    ]


def seed_default_llm_providers(db: Session) -> None:
    """Insert default providers if missing; idempotent per name."""
    existing_providers = db.query(LLMProvider).all()
    existing_names = {p.name for p in existing_providers}

    providers_to_add = [p for p in _default_providers() if p.name not in existing_names]
    if not providers_to_add:
        print(f"ℹ️ LLM providers already exist ({len(existing_providers)}). Skipping seed.")
        return

    print(f"🌱 Seeding default LLM providers ({len(providers_to_add)} new)...")
    db.add_all(providers_to_add)
    db.commit()
    print("✅ Default LLM providers seeded!")


def seed_default_llm_models(db: Session) -> None:
    """
    KNOWN_MODEL_PRICES를 기반으로 기본 LLM 모델을 시드합니다.
    gpt-4.1, o3-mini와 같은 모델이 DB에 존재하도록 보장합니다.
    또한, 해당 모델이 UI에 표시되도록 기존 Credential과 연결합니다.
    """
    from services.llm_service import LLMService
    from shared.db.models.llm import LLMProvider, LLMModel, LLMCredential, LLMRelCredentialModel

    # 1. 모든 Provider 조회 후 맵핑 생성
    providers = db.query(LLMProvider).all()
    provider_map = {p.name: p for p in providers}

    # 2. 기존 생성된 모델 조회
    existing_models = db.query(LLMModel).all()
    existing_model_ids = {m.model_id_for_api_call for m in existing_models}

    # Provider 매핑 규칙 (휴리스틱)
    def get_provider_name(model_id: str) -> str:
        if model_id.startswith("claude"):
            return "anthropic"
        elif model_id.startswith("gemini"):
            return "google"
        elif model_id.startswith("llamaparse"):
            return "llamaparse"
        else:
            return "openai" # gpt, o1, o3, dall-e, tts, whisper 등은 기본적으로 OpenAI로 처리

    models_seeded_count = 0
    models_updated_count = 0

    # 3. KNOWN_MODEL_PRICES 순회하며 모델 생성 또는 가격 업데이트
    for model_id, pricing in LLMService.KNOWN_MODEL_PRICES.items():
        provider_name = get_provider_name(model_id)
        provider = provider_map.get(provider_name)
        
        if not provider:
            # print(f"⚠️ Provider '{provider_name}' not found for model '{model_id}'. Skipping.")
            continue
            
        # 모델 찾기 또는 생성
        model = None
        if model_id in existing_model_ids:
            # 기존 모델 객체 찾기
            model = next((m for m in existing_models if m.model_id_for_api_call == model_id), None)
            # [NEW] 기존 모델이지만 가격 정보가 없으면 업데이트
            if model and (model.input_price_1k is None or model.output_price_1k is None):
                model.input_price_1k = pricing["input"]
                model.output_price_1k = pricing["output"]
                db.add(model)
                models_updated_count += 1
        else:
            # 새 모델 생성
            new_model_uuid = uuid.uuid4()
            model = LLMModel(
                id=new_model_uuid,
                provider_id=provider.id,
                model_id_for_api_call=model_id,
                name=model_id, 
                type="embedding" if "embedding" in model_id else "chat",
                context_window=128000 if "gpt-4" in model_id or "o1" in model_id or "claude" in model_id else 8192,
                input_price_1k=pricing["input"],
                output_price_1k=pricing["output"],
                is_active=True
            )
            db.add(model)
            models_seeded_count += 1
            # 중복 방지를 위해 캐시 업데이트
            existing_model_ids.add(model_id)
            existing_models.append(model)
        
        if not model: continue

        # Provider의 기존 Credential에 연결 (선택사항 - 조회 로직 변경으로 인해 필수는 아니지만 안전장치로 유지)
        # 1. 해당 Provider의 모든 Credential 조회
        creds = db.query(LLMCredential).filter(LLMCredential.provider_id == provider.id).all()
        
        # 2. 이미 연결된 내역 확인
        existing_links = db.query(LLMRelCredentialModel).filter(
            LLMRelCredentialModel.model_id == model.id
        ).all()
        linked_cred_ids = {link.credential_id for link in existing_links}
        
        # 3. 누락된 연결 추가
        for cred in creds:
             if cred.id not in linked_cred_ids:
                 rel = LLMRelCredentialModel(
                     credential_id=cred.id,
                     model_id=model.id,
                     is_verified=True
                 )
                 db.add(rel)
                 # print(f"   Configs: Linked {model_id} to Credential {cred.credential_name}")

    if models_seeded_count > 0 or models_updated_count > 0:
        if models_seeded_count > 0:
            print(f"🌱 Seeded {models_seeded_count} new LLM models.")
        if models_updated_count > 0:
            print(f"💰 Updated pricing for {models_updated_count} existing models.")
        db.commit()
        print("✅ LLM models sync complete!")
    else:
        print("ℹ️ LLM models up to date.")
