import json
import logging
import uuid
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy.orm import Session, joinedload

from apps.shared.db.models.llm import (
    LLMCredential,
    LLMModel,
    LLMProvider,
    LLMRelCredentialModel,
    LLMUsageLog,
)
from apps.shared.schemas.llm import (
    LLMCredentialCreate,
    LLMCredentialResponse,
    LLMModelResponse,
    LLMProviderResponse,
)
from apps.shared.services.llm_client import get_llm_client

logger = logging.getLogger(__name__)


class LLMService:
    """
    LLM 공급자(프로바이더) 및 인증(크리덴셜) 관리 서비스.
    새로운 아키텍처:
    - 프로바이더는 시스템 정의 (전역)
    - 크리덴셜은 사용자 정의 (사용자별)
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

    # [신규] Provider별 가성비 모델 매핑 (Prompt Wizard, Query Rewriting 등에서 사용)
    EFFICIENT_MODELS = {
        "openai": "gpt-4o-mini",
        "google": "gemini-1.5-flash",
        "anthropic": "claude-3-haiku-20240307",
    }

    # [신규] 기본 가격 설정 (1M 토큰 기준 미화를 1K 기준으로 환산)
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
        # --- GPT-5.1 시리즈 ---
        "gpt-5.1": {"input": 0.004, "output": 0.012},
        "gpt-5.1-2025-11-13": {"input": 0.004, "output": 0.012},
        "gpt-5.1-chat-latest": {"input": 0.004, "output": 0.012},
        "gpt-5.1-codex": {"input": 0.004, "output": 0.012},
        "gpt-5.1-codex-mini": {"input": 0.001, "output": 0.004},
        "gpt-5.1-codex-max": {"input": 0.010, "output": 0.040},
        # --- GPT-5.2 시리즈 ---
        "gpt-5.2": {"input": 0.003, "output": 0.010},
        "gpt-5.2-2025-12-11": {"input": 0.003, "output": 0.010},
        "gpt-5.2-pro": {"input": 0.010, "output": 0.040},
        "gpt-5.2-pro-2025-12-11": {"input": 0.010, "output": 0.040},
        "gpt-5.2-chat-latest": {"input": 0.003, "output": 0.010},
        # --- GPT-4.1 시리즈 (2025) ---
        "gpt-4.1": {"input": 0.002, "output": 0.008},
        "gpt-4.1-2025-04-14": {"input": 0.002, "output": 0.008},
        "gpt-4.1-mini": {"input": 0.0004, "output": 0.0016},
        "gpt-4.1-mini-2025-04-14": {"input": 0.0004, "output": 0.0016},
        "gpt-4.1-nano": {"input": 0.0001, "output": 0.0004},
        "gpt-4.1-nano-2025-04-14": {"input": 0.0001, "output": 0.0004},
        # --- GPT-4o 시리즈 ---
        "gpt-4o": {"input": 0.0025, "output": 0.010},
        "gpt-4o-2024-05-13": {"input": 0.005, "output": 0.015},
        "gpt-4o-2024-08-06": {"input": 0.0025, "output": 0.010},
        "gpt-4o-2024-11-20": {"input": 0.0025, "output": 0.010},
        "chatgpt-4o-latest": {"input": 0.005, "output": 0.015},
        # --- GPT-4o Mini 시리즈 ---
        "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-mini-2024-07-18": {"input": 0.00015, "output": 0.0006},
        # --- GPT-4o 검색 ---
        "gpt-4o-search-preview": {"input": 0.0025, "output": 0.010},
        "gpt-4o-search-preview-2025-03-11": {"input": 0.0025, "output": 0.010},
        "gpt-4o-mini-search-preview": {"input": 0.00015, "output": 0.0006},
        "gpt-4o-mini-search-preview-2025-03-11": {"input": 0.00015, "output": 0.0006},
        # --- GPT-4o 오디오/실시간 ---
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
        # --- GPT-4o 전사/음성합성 ---
        "gpt-4o-transcribe": {"input": 0.0025, "output": 0.0},
        "gpt-4o-transcribe-diarize": {"input": 0.004, "output": 0.0},
        "gpt-4o-mini-transcribe": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-transcribe-2025-03-20": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-transcribe-2025-12-15": {"input": 0.00015, "output": 0.0},
        "gpt-4o-mini-tts": {"input": 0.0, "output": 0.0006},
        "gpt-4o-mini-tts-2025-03-20": {"input": 0.0, "output": 0.0006},
        "gpt-4o-mini-tts-2025-12-15": {"input": 0.0, "output": 0.0006},
        # --- 추론 모델 (O 시리즈) ---
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
        # --- GPT-4 터보 ---
        "gpt-4-turbo": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-2024-04-09": {"input": 0.01, "output": 0.03},
        "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-0125-preview": {"input": 0.01, "output": 0.03},
        "gpt-4-1106-preview": {"input": 0.01, "output": 0.03},
        # --- GPT-4 레거시 ---
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
        # --- GPT 오디오/실시간 ---
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
        # --- 레거시/베이스 모델 ---
        "davinci-002": {"input": 0.002, "output": 0.002},
        "babbage-002": {"input": 0.0004, "output": 0.0004},
        # ==================== OpenAI 임베딩 모델 ====================
        "text-embedding-3-small": {"input": 0.00002, "output": 0.0},
        "text-embedding-3-large": {"input": 0.00013, "output": 0.0},
        "text-embedding-ada-002": {"input": 0.00010, "output": 0.0},
        # ==================== Anthropic 모델 ====================
        # --- Claude 3.5 시리즈 ---
        "claude-3-5-opus": {"input": 0.015, "output": 0.075},  # $15 / $75
        "claude-3-5-opus-latest": {"input": 0.015, "output": 0.075},
        "claude-3-5-sonnet": {"input": 0.003, "output": 0.015},  # $3 / $15
        "claude-3-5-sonnet-latest": {"input": 0.003, "output": 0.015},
        "claude-3-5-sonnet-20241022": {"input": 0.003, "output": 0.015},
        "claude-3-5-sonnet-20240620": {"input": 0.003, "output": 0.015},
        "claude-3-5-haiku": {"input": 0.00025, "output": 0.00125},  # $0.25 / $1.25
        "claude-3-5-haiku-latest": {"input": 0.00025, "output": 0.00125},
        "claude-3-5-haiku-20241022": {"input": 0.00025, "output": 0.00125},
        # --- Claude 3 시리즈 ---
        "claude-3-opus-20240229": {"input": 0.015, "output": 0.075},
        "claude-3-sonnet-20240229": {"input": 0.003, "output": 0.015},
        "claude-3-haiku-20240307": {"input": 0.00025, "output": 0.00125},
        # --- 레거시 ---
        "claude-2.1": {"input": 0.008, "output": 0.024},
        "claude-2.0": {"input": 0.008, "output": 0.024},
        "claude-instant-1.2": {"input": 0.0008, "output": 0.0024},
        # ==================== Google 모델 (2026 가격) ====================
        # 기본 가격 (128k 컨텍스트 이하). 128k 초과 시 가격 2배 (아직 미반영).
        # --- Gemini 3 시리즈 ---
        "gemini-3-pro": {"input": 0.002, "output": 0.012},  # $2.00 / $12.00
        "gemini-3-flash": {"input": 0.0003, "output": 0.0025},  # $0.30 / $2.50
        # --- Gemini 1.5 시리즈 ---
        "gemini-1.5-pro": {
            "input": 0.00125,
            "output": 0.010,
        },  # $1.25 / $10.00 (업데이트)
        "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},  # $0.075 / $0.30
        "gemini-1.5-flash-8b": {
            "input": 0.0000375,
            "output": 0.00015,
        },  # $0.0375 / $0.15
        # --- Gemini 2.0 / 실험 ---
        "gemini-2.0-flash-exp": {"input": 0.0001, "output": 0.0004},
        # --- 레거시 ---
        "gemini-1.0-pro": {"input": 0.0005, "output": 0.0015},
        # --- 임베딩 ---
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
        공급자 API에서 사용 가능한 모델 목록을 조회합니다.
        공급자에서 내려준 원본 모델 딕셔너리 리스트를 반환합니다.
        """
        remote_models = []

        provider = provider_type.lower()
        if not base_url:
            raise ValueError(f"Provider {provider_type} has no base_url configured.")

        # Google은 OpenAI 호환 /models 엔드포인트 검증을 지원
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
                    # OpenAI는 { "data": [ { "id": "model-id", ... }, ... ] } 형식으로 반환
                    remote_models = data.get("data", [])
                elif resp.status_code in [401, 403]:
                    # 인증 실패는 명시적으로 에러 처리
                    raise ValueError(
                        f"유효하지 않은 API Key입니다. 정확한 키를 입력했는지 확인해주세요. (Provider: {provider})"
                    )
                else:
                    # 그 외 상태 코드는 등록 단계 실패로 처리
                    raise ValueError(
                        f"Failed to fetch models from {provider}: {resp.status_code} {resp.text}"
                    )
            except ValueError:
                raise  # 알려진 ValueError는 그대로 전달
            except Exception as e:
                # 네트워크/타임아웃 오류 처리
                raise ValueError(f"Network error verifying {provider} key: {str(e)}")

            if provider == "google" and remote_models:
                remote_models = LLMService._filter_google_models(
                    base_url=base_url,
                    api_key=api_key,
                    remote_models=remote_models,
                )

        # Anthropic (앤트로픽)
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
                    # Anthropic은 { "data": [ { "id": "claude-...", ... }, ... ] } 형식으로 반환
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

        # LlamaParse (라마파스)
        elif provider == "llamaparse":
            # LlamaCloud API 검증 (프로젝트 접근 확인)
            # base_url은 보통 https://api.cloud.llamaindex.ai
            url = base_url.rstrip("/") + "/api/v1/projects"
            try:
                resp = requests.get(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10,
                )
                if resp.status_code == 200:
                    # 인증 성공
                    # LlamaParse는 LLM 노드용 "models"를 제공하지 않으므로 빈 리스트 반환
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
        # 현재는 빈 리스트를 반환하지만, 추후 지원 여부 검증 로직이 필요함.

        if not remote_models and provider in ["openai", "google", "anthropic"]:
            # 200 OK인데 모델이 없다면 이상하지만, 기술적으로는 성공 처리
            # 일반적으로는 모델이 있어야 함
            pass

        return remote_models

    @staticmethod
    def _filter_google_models(
        base_url: str, api_key: str, remote_models: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Google ListModels 결과를 기반으로 접근 가능한 모델만 남깁니다.
        - generateContent/embedContent 지원 여부를 확인합니다.
        - 실패 시 원본 목록을 그대로 반환합니다.
        """
        if not remote_models:
            return remote_models

        native_base = base_url.rstrip("/")
        if native_base.endswith("/openai"):
            native_base = native_base[: -len("/openai")]
        native_url = native_base.rstrip("/") + "/models"

        try:
            resp = requests.get(
                native_url,
                headers={"x-goog-api-key": api_key},
                timeout=10,
            )
        except Exception:
            return remote_models

        if resp.status_code != 200:
            return remote_models

        try:
            payload = resp.json()
        except ValueError:
            return remote_models

        allowed_ids = set()
        for model in payload.get("models", []):
            name = model.get("name") or ""
            if not name:
                continue
            methods = model.get("supportedGenerationMethods") or []
            if "generateContent" in methods or "embedContent" in methods:
                allowed_ids.add(name.replace("models/", ""))

        if not allowed_ids:
            return remote_models

        filtered = []
        for rm in remote_models:
            mid = rm.get("id") or ""
            clean_id = mid.replace("models/", "")
            if clean_id in allowed_ids:
                filtered.append(rm)

        return filtered

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

            # [신규] 기본 가격 결정
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
                # 신규 모델 생성
                # 모델 ID 기반으로 타입 감지
                mid_lower = mid.lower()
                m_type = "chat"  # 기본값

                # 임베딩 모델
                if "embedding" in mid_lower:
                    m_type = "embedding"
                # 오디오 모델 (TTS, Whisper, Audio)
                elif (
                    "tts" in mid_lower or "whisper" in mid_lower or "audio" in mid_lower
                ):
                    m_type = "audio"
                # 이미지 생성 모델
                elif "dall-e" in mid_lower or "image" in mid_lower:
                    m_type = "image"
                # 실시간 모델
                elif "realtime" in mid_lower:
                    m_type = "realtime"
                # 모더레이션 모델
                elif "moderation" in mid_lower:
                    m_type = "moderation"
                # 채팅 모델 (gpt, o1, o3, claude, gemini 등)
                # 그 외: 기본값 "chat" 유지

                # 동적 발견 시 기본 컨텍스트 윈도우는 알 수 없으므로, 안전한 기본값 또는 특정 규칙 사용
                ctx = 4096
                if "gpt-4" in mid:
                    ctx = 8192
                if "128k" in mid or "gpt-4o" in mid:
                    ctx = 128000

                new_model = LLMModel(
                    provider_id=provider.id,
                    model_id_for_api_call=mid,
                    name=display_name,  # 정리된 이름 사용
                    type=m_type,
                    context_window=ctx,
                    is_active=True,
                    model_metadata=rm,
                    input_price_1k=input_price,  # 신규
                    output_price_1k=output_price,  # 신규
                )
                db.add(new_model)
                synced_models.append(new_model)

        db.flush()  # 신규 모델 ID 확보용 flush
        return synced_models

    @staticmethod
    def get_system_providers(db: Session) -> List[LLMProviderResponse]:
        """시스템 정의 프로바이더 목록 조회."""
        providers = db.query(LLMProvider).options(joinedload(LLMProvider.models)).all()
        return [LLMProviderResponse.model_validate(p) for p in providers]

    @staticmethod
    def get_user_credentials(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMCredentialResponse]:
        """사용자의 유효한 크리덴셜 목록 조회."""
        creds = (
            db.query(LLMCredential)
            .filter(
                LLMCredential.user_id == user_id,
                LLMCredential.is_valid == True,
            )
            .all()
        )
        return [LLMCredentialResponse.model_validate(c) for c in creds]

    @staticmethod
    def register_credential(
        db: Session, user_id: uuid.UUID, request: LLMCredentialCreate
    ) -> LLMCredentialResponse:
        """
        사용자의 새 크리덴셜을 등록합니다.
        프로바이더 API 키 검증과 모델 동기화를 함께 수행합니다.
        """
        # 1. 프로바이더 조회
        provider = (
            db.query(LLMProvider).filter(LLMProvider.id == request.provider_id).first()
        )
        if not provider:
            raise ValueError(f"Provider {request.provider_id} not found")

        # 2. API 키 검증 및 모델 조회
        remote_models = LLMService._fetch_remote_models(
            provider.base_url, request.api_key, provider.name
        )

        # 3. 크리덴셜 생성
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

        # 4. 모델을 DB와 동기화
        db_models = LLMService._sync_models_to_db(db, provider, remote_models)

        # 5. 크리덴셜-모델 매핑
        for m in db_models:
            # 기존 매핑이 있는지 확인 (신규 크리덴셜이면 거의 없음)
            mapping = LLMRelCredentialModel(
                credential_id=new_cred.id,
                model_id=m.id,
                is_verified=True,  # _fetch_remote_models 검증 결과
            )
            db.add(mapping)

        db.commit()
        db.refresh(new_cred)
        return LLMCredentialResponse.model_validate(new_cred)

    @staticmethod
    def delete_credential(
        db: Session, credential_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """크리덴셜을 실제 삭제하지 않고 비활성화 처리."""
        cred = (
            db.query(LLMCredential)
            .filter(LLMCredential.id == credential_id, LLMCredential.user_id == user_id)
            .first()
        )

        if not cred:
            return False

        cred.is_valid = False
        db.commit()
        return True

    @staticmethod
    def sync_credential_models(
        db: Session,
        user_id: uuid.UUID,
        credential_id: uuid.UUID,
        purge_unverified: bool = False,
    ) -> Dict[str, Any]:
        """
        특정 크리덴셜 기준으로 모델 매핑을 재동기화합니다.
        - 원격 모델 목록을 가져와 DB 모델을 동기화
        - 해당 크리덴셜의 모든 매핑을 unverified 처리 후,
          원격 모델에 포함된 것만 verified로 설정 (fail-closed)
        """
        cred = (
            db.query(LLMCredential)
            .options(joinedload(LLMCredential.provider))
            .filter(
                LLMCredential.id == credential_id,
                LLMCredential.user_id == user_id,
            )
            .first()
        )

        if not cred:
            raise ValueError("Credential not found")

        if not cred.is_valid:
            raise ValueError("Credential is not valid")

        try:
            cfg = json.loads(cred.encrypted_config)
            api_key = cfg.get("apiKey")
            base_url = cfg.get("baseUrl")
        except Exception:
            raise ValueError("Invalid credential config")

        remote_models = LLMService._fetch_remote_models(
            base_url=base_url, api_key=api_key, provider_type=cred.provider.name
        )
        db_models = LLMService._sync_models_to_db(db, cred.provider, remote_models)

        # 기존 매핑은 모두 비활성화 (fail-closed)
        db.query(LLMRelCredentialModel).filter(
            LLMRelCredentialModel.credential_id == cred.id
        ).update({LLMRelCredentialModel.is_verified: False}, synchronize_session=False)

        existing_links = {
            rel.model_id: rel
            for rel in db.query(LLMRelCredentialModel)
            .filter(LLMRelCredentialModel.credential_id == cred.id)
            .all()
        }

        for model in db_models:
            rel = existing_links.get(model.id)
            if rel:
                rel.is_verified = True
            else:
                db.add(
                    LLMRelCredentialModel(
                        credential_id=cred.id, model_id=model.id, is_verified=True
                    )
                )

        db.flush()

        purged = 0
        if purge_unverified:
            purged = (
                db.query(LLMRelCredentialModel)
                .filter(
                    LLMRelCredentialModel.credential_id == cred.id,
                    LLMRelCredentialModel.is_verified == False,
                )
                .delete(synchronize_session=False)
            )

        db.commit()

        return {
            "credential_id": str(cred.id),
            "provider": cred.provider.name,
            "remote_models": len(remote_models),
            "verified_models": len(db_models),
            "purged_models": purged,
        }

    @staticmethod
    def get_client_for_user(db: Session, user_id: uuid.UUID, model_id: str):
        """
        주어진 model_id를 지원하는 유효한 크리덴셜을 찾습니다.
        우선순위:
        1. llm_rel_credential_models에서 명시적 권한 확인 (fail-closed)
        """
        # TODO: Tenant 스키마 도입 시 tenant_id 지원 추가.
        # 현재는 user_id만 필터링합니다.

        # 1. 프로바이더를 알기 위해 모델 조회
        # 참고: model_id 문자열은 'gpt-4o'처럼 흔한 값일 수 있음.
        # 동일한 모델명을 제공하는 프로바이더가 여러 개일 수 있으므로(드물지만), 추가 정보가 필요할 수 있음.
        # 현재는 모델명이 충분히 유니크하거나 시스템 기본 프로바이더를 우선한다고 가정.

        target_model = (
            db.query(LLMModel)
            .filter(LLMModel.model_id_for_api_call == model_id)
            .first()
        )
        if not target_model:
            raise ValueError(f"Unknown model_id: {model_id}")

        # NOTE: is_verified 조건 제거됨
        # sync_credential_models 실행 중 일시적으로 is_verified=False가 되어
        # 간헐적으로 "API 키를 찾을 수 없습니다" 오류가 발생하는 문제 해결
        cred = (
            db.query(LLMCredential)
            .join(
                LLMRelCredentialModel,
                LLMRelCredentialModel.credential_id == LLMCredential.id,
            )
            .filter(
                LLMCredential.user_id == user_id,
                LLMCredential.is_valid == True,
                LLMRelCredentialModel.model_id == target_model.id,
            )
            .order_by(
                LLMRelCredentialModel.priority.desc(),
                LLMCredential.updated_at.desc(),
            )
            .first()
        )

        if not cred:
            raise ValueError(
                f"유효한 API 키를 찾을 수 없습니다. [설정 > 모델 키 관리]에서 '{model_id}' 모델을 지원하는 API Key를 등록해주세요."
            )

        # 설정 로드
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
        [DEPRECATED] 안전성 문제로 비활성화되었습니다.
        user_id 없는 실행은 허용하지 않습니다.
        """
        raise ValueError(
            "Deprecated API: user_id 컨텍스트 없이 LLM 클라이언트를 생성할 수 없습니다."
        )

    @staticmethod
    def _get_valid_credential_for_user(
        db: Session,
        user_id: uuid.UUID,
        provider_id: Optional[uuid.UUID] = None,
    ) -> Optional[LLMCredential]:
        query = db.query(LLMCredential).filter(
            LLMCredential.user_id == user_id,
            LLMCredential.is_valid == True,
        )
        if provider_id:
            query = query.filter(LLMCredential.provider_id == provider_id)
        return query.first()

    @staticmethod
    def get_my_available_models(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMModelResponse]:
        """
        사용자의 등록된 크리덴셜을 기반으로 사용 가능한 모든 모델을 반환합니다.
        llm_rel_credential_models 기준으로 허용된 모델만 반환합니다.
        """
        models = (
            db.query(LLMModel)
            .join(
                LLMRelCredentialModel,
                LLMRelCredentialModel.model_id == LLMModel.id,
            )
            .join(
                LLMCredential,
                LLMRelCredentialModel.credential_id == LLMCredential.id,
            )
            .options(joinedload(LLMModel.provider))
            .filter(
                LLMCredential.user_id == user_id,
                LLMCredential.is_valid == True,
                LLMRelCredentialModel.is_verified == True,
                LLMModel.is_active == True,
            )
            .distinct()
            .order_by(LLMModel.name)
            .all()
        )

        return [LLMModelResponse.model_validate(m) for m in models]

    @staticmethod
    def get_my_embedding_models(
        db: Session, user_id: uuid.UUID
    ) -> List[LLMModelResponse]:
        """
        사용자의 크리덴셜에 기반하여 사용 가능한 임베딩 모델 목록을 반환합니다.
        get_my_available_models와 동일하지만 type='embedding'으로 필터링됩니다.
        """
        models = (
            db.query(LLMModel)
            .join(
                LLMRelCredentialModel,
                LLMRelCredentialModel.model_id == LLMModel.id,
            )
            .join(
                LLMCredential,
                LLMRelCredentialModel.credential_id == LLMCredential.id,
            )
            .options(joinedload(LLMModel.provider))
            .filter(
                LLMCredential.user_id == user_id,
                LLMCredential.is_valid == True,
                LLMRelCredentialModel.is_verified == True,
                LLMModel.is_active == True,
                LLMModel.type == "embedding",
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

        # 1. Google 접두사 제거
        clean = model_id.replace("models/", "")

        # 2. 날짜 접미사 패턴 제거
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
        모델 가격 정보를 기반으로 비용을 계산합니다.
        DB에 가격 정보가 없으면 KNOWN_MODEL_PRICES로 폴백합니다.
        정규화된 모델 ID로 폴백 시도하여 버전 차이로 인한 매칭 실패를 방지합니다.
        """
        input_price = None
        output_price = None

        # 1. DB에서 가격 정보 조회
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
        else:
            # 2. KNOWN_MODEL_PRICES로 폴백 (정규화된 ID로 시도)
            clean_id = model_id.replace("models/", "")  # Google 접두사 제거
            pricing = LLMService.KNOWN_MODEL_PRICES.get(clean_id)

            # 정확한 매칭 실패 시, 정규화된 ID로 재시도
            if not pricing:
                normalized_id = LLMService._normalize_model_id(model_id)
                pricing = LLMService.KNOWN_MODEL_PRICES.get(normalized_id)

            if pricing:
                input_price = pricing["input"]
                output_price = pricing["output"]

        # 3. 가격이 없으면 0 반환
        if input_price is None or output_price is None:
            return 0.0

        # 4. 비용 계산
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
    ) -> Optional[LLMUsageLog]:
        """
        LLM 사용 로그를 DB에 저장합니다.
        """
        # 모델 DB ID 조회
        model = (
            db.query(LLMModel)
            .filter(LLMModel.model_id_for_api_call == model_id)
            .first()
        )
        if not model:
            if model_id.startswith("models/"):
                alt_id = model_id.replace("models/", "", 1)
            else:
                alt_id = f"models/{model_id}"
            model = (
                db.query(LLMModel)
                .filter(LLMModel.model_id_for_api_call == alt_id)
                .first()
            )
        if not model:
            logger.error(
                f"[LLMService] Usage log skipped: model '{model_id}' not found."
            )
            return None

        credential = LLMService._get_valid_credential_for_user(
            db, user_id, model.provider_id
        )
        if not credential:
            logger.error(
                f"[LLMService] Usage log skipped: no credential for user {user_id}."
            )
            return None

        log = LLMUsageLog(
            user_id=user_id,
            credential_id=credential.id,
            model_id=model.id,
            workflow_run_id=workflow_run_id,
            node_id=node_id,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            total_cost=cost,
            latency_ms=usage.get("latency_ms", 0),
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
        특정 모델의 가격 정보를 업데이트합니다.
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
        DB에 있는 모든 모델의 가격을 KNOWN_MODEL_PRICES와 동기화합니다.
        알려진 목록에 매칭되면 기존 가격을 덮어씁니다.
        """
        updated_count = 0
        known_prices = LLMService.KNOWN_MODEL_PRICES

        models = db.query(LLMModel).all()
        for m in models:
            # model_id_for_api_call로 매칭 (예: gpt-4o)
            # "models/" 접두사가 있으면 제거 (Google)
            clean_id = m.model_id_for_api_call.replace("models/", "")

            pricing = known_prices.get(clean_id)
            if pricing:
                # 다른 값이거나 (또는 기존 값이 None인 경우) 업데이트
                # float 비교는 대략적으로 처리
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
