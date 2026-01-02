"""
Database seed helpers for startup.

- Seeds a placeholder user for local/dev
- Seeds system LLM providers (idempotent)
"""

import uuid
from typing import Iterable

from sqlalchemy.orm import Session

from db.models.llm import LLMProvider
from db.models.user import User


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
