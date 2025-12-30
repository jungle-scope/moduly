import json
import uuid
from typing import List, Optional

import requests
from sqlalchemy.orm import Session, joinedload

from db.models.llm import LLMCredential, LLMProvider
from db.models.user import User
from schemas.llm import (
    LLMCredentialResponse,
    LLMProviderResponse,
    LLMProviderSimpleCreate,
)
from services.llm_client.factory import get_llm_client


class LLMService:
    """
    LLM provider/credential 관련 DB 작업을 담당합니다.
    """

    # 임시 placeholder 사용자 ID (실제 users 테이블에 없으면 FK 에러 날 수 있음)
    # TODO: 로그인 연동 후 실제 사용자로 대체하고 제거 필요
    PLACEHOLDER_USER_ID = uuid.UUID("12345678-1234-5678-1234-567812345678")

    @staticmethod
    def _mask_plain(value: str) -> str:
        """
        문자열을 앞4 + **** + 뒤2 형태로 마스킹합니다.
        """
        if not value:
            return ""
        if len(value) <= 6:
            return "*" * len(value)
        return f"{value[:4]}****{value[-2:]}"

    @staticmethod
    def _mask_secret(secret: str) -> str:
        """
        클라이언트로 반환할 때 키를 그대로 노출하지 않기 위해 마스킹합니다.
        - 암호화는 제거되었지만, API key가 그대로 노출되지 않도록 최소한의 보호를 유지합니다.
        - 앞 4글자 + **** + 끝 2글자 형태. 6글자 이하라면 '*' 반복.
        - JSON 문자열이면 apiKey/api_key 필드를 찾아 마스킹 후 JSON 문자열로 반환
        - TODO: 운영 전 암호화를 다시 적용할 때 마스킹 로직은 그대로 유지
        """
        if not secret:
            return ""
        # JSON 형태면 내부 apiKey만 마스킹
        try:
            loaded = json.loads(secret)
            if isinstance(loaded, dict):
                api_key = loaded.get("apiKey") or loaded.get("api_key")
                if api_key:
                    masked = LLMService._mask_plain(api_key)
                    loaded["apiKey"] = masked
                    if "api_key" in loaded:
                        loaded["api_key"] = masked
                return json.dumps(loaded)
        except Exception:
            pass

        # 일반 문자열이면 전체를 마스킹
        return LLMService._mask_plain(secret)

    @staticmethod
    def _load_credential_config(credential: LLMCredential) -> dict:
        """
        credential.encrypted_config를 JSON으로 파싱해 dict로 반환합니다.
        - 현재는 암호화 없이 평문 JSON을 저장/사용합니다.
        - TODO: 운영 시 암호화를 복구할 때 이 함수도 수정 필요
        """
        raw = credential.encrypted_config

        try:
            loaded = json.loads(raw)
            if isinstance(loaded, dict):
                return loaded
        except Exception:
            pass

        raise ValueError("credential 설정을 파싱할 수 없습니다. (JSON 형식 아님)")

    @staticmethod
    def _validate_openai_api_key(base_url: str, api_key: str) -> None:
        """
        OpenAI /models 엔드포인트로 키 유효성 검증.
        - 200 OK이면 통과, 그 외 status는 실패로 간주
        - 네트워크/타임아웃/기타 예외는 ValueError로 올려 사용자에게 전달
        """
        url = base_url.rstrip("/") + "/models"
        try:
            resp = requests.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=5,
            )
        except requests.RequestException as exc:
            raise ValueError(f"OpenAI API key 검증 요청 실패: {exc}") from exc

        if resp.status_code != 200:
            snippet = resp.text[:200] if resp.text else ""
            raise ValueError(
                f"OpenAI API key 검증 실패 (status {resp.status_code}): {snippet}"
            )

    @staticmethod
    def _resolve_user_id(db: Session, user_id: Optional[uuid.UUID]) -> uuid.UUID:
        """
        임시 방편:
        - 요청 user_id가 있으면 그대로 사용
        - 없으면 DB에 존재하는 첫 번째 사용자 사용 (공유 모드)
        - 그래도 없으면 눈에 띄는 placeholder UUID(12345678-...) 사용자 레코드 자동 생성/사용
        FK 제약 때문에 users 테이블에 실제 레코드가 없으면 INSERT가 실패할 수 있습니다.
        TODO: 로그인 연동 후 현재 사용자로 대체하고 placeholder 제거.
        """
        raw_user_id = user_id

        # 1) 요청 기반으로 시도
        if raw_user_id:
            try:
                resolved = uuid.UUID(str(raw_user_id))
            except (TypeError, ValueError) as exc:
                raise ValueError("user_id가 올바른 UUID 형식이 아닙니다.") from exc
            user = db.query(User).filter(User.id == resolved).first()
            if user:
                return resolved
            # 존재하지 않으면 이어서 DB에서 fallback 찾기

        # 2) DB에 존재하는 첫 사용자로 fallback (임시 공유용)
        fallback_user = db.query(User).first()
        if fallback_user:
            return fallback_user.id

        # 3) 완전히 없을 때는 placeholder 사용자 레코드를 생성/사용
        placeholder_user = (
            db.query(User).filter(User.id == LLMService.PLACEHOLDER_USER_ID).first()
        )
        if not placeholder_user:
            placeholder_user = User(
                id=LLMService.PLACEHOLDER_USER_ID,
                email="placeholder-llm@moduly.local",
                name="placeholder-llm-user",
                password=None,
            )
            db.add(placeholder_user)
            db.flush()  # placeholder 사용자 생성 (commit은 상위에서 처리)
            print(
                "[llm] WARNING: created placeholder user for provider creation. "
                "TODO: 로그인 연동 후 실제 사용자로 대체 필요."
            )
        else:
            print(
                "[llm] WARNING: using existing placeholder user for provider creation. "
                "TODO: 로그인 연동 후 실제 사용자로 대체 필요."
            )
        return LLMService.PLACEHOLDER_USER_ID

    @staticmethod
    def create_provider_with_credential(
        db: Session, request: LLMProviderSimpleCreate
    ) -> LLMProviderResponse:
        """
        alias + openai 필수 값(apiKey/baseUrl/model)으로 provider와 credential을 함께 생성합니다.

        1) user_id 결정 (요청값 → DB 첫 사용자 → placeholder)
        2) provider 생성/flush로 ID 확보
        3) credential 생성: encrypted_config에 JSON 문자열로 apiKey/baseUrl/model 저장 (TODO: 암호화)
        4) provider.credential_id 연결 후 commit
        5) 생성된 provider + credential을 응답 모델로 반환 (apiKey는 마스킹)
        """
        resolved_user_id = LLMService._resolve_user_id(db, request.user_id)
        config_payload = {
            "apiKey": request.api_key,
            "baseUrl": request.base_url,
            "model": request.model,
            "providerType": request.provider_type,
        }

        # 현재는 openai만 지원: /models 호출로 키 검증 (실패 시 ValueError)
        if request.provider_type.lower() == "openai":
            LLMService._validate_openai_api_key(
                base_url=request.base_url, api_key=request.api_key
            )
        else:
            # 향후 다른 provider 추가 시 여기에 분기
            pass

        provider = LLMProvider(
            user_id=resolved_user_id,
            provider_name=request.alias,
            provider_type=request.provider_type,
            quota_type="none",
            quota_limit=-1,
            quota_used=0,
            is_valid=True,
        )
        db.add(provider)
        db.flush()  # provider.id 확보

        credential = LLMCredential(
            provider_id=provider.id,
            user_id=resolved_user_id,
            credential_name=request.alias,
            encrypted_config=json.dumps(config_payload),
            is_valid=True,
        )
        db.add(credential)
        db.flush()  # credential.id 확보

        provider.credential_id = credential.id
        db.add(provider)
        db.commit()

        # 응답 모델 생성 (관계 로딩 없이 직접 구성)
        masked_api_key = LLMService._mask_secret(credential.encrypted_config)
        provider_response = LLMProviderResponse(
            id=provider.id,
            user_id=provider.user_id,
            provider_name=provider.provider_name,
            provider_type=provider.provider_type,
            credential_id=provider.credential_id,
            quota_type=provider.quota_type,
            quota_limit=provider.quota_limit,
            quota_used=provider.quota_used,
            is_valid=provider.is_valid,
            created_at=provider.created_at,
            updated_at=provider.updated_at,
            credentials=[
                LLMCredentialResponse(
                    id=credential.id,
                    provider_id=credential.provider_id,
                    user_id=credential.user_id,
                    credential_name=credential.credential_name,
                    encrypted_config=masked_api_key,
                    is_valid=credential.is_valid,
                    created_at=credential.created_at,
                    updated_at=credential.updated_at,
                )
            ],
        )

        print(
            "[llm] provider created",
            {
                "provider_id": str(provider_response.id),
                "credential_id": str(credential.id),
                "user_id": str(provider_response.user_id),
            },
        )

        return provider_response

    @staticmethod
    def list_providers(db: Session) -> List[LLMProviderResponse]:
        """
        provider 전체 목록 + credential을 반환합니다. (임시 공유 모드)
        - API key는 마스킹해서 반환합니다.
        - TODO: 추후 로그인 사용자별 필터로 전환 필요.
        """
        providers = (
            db.query(LLMProvider).options(joinedload(LLMProvider.credentials)).all()
        )

        response_list: List[LLMProviderResponse] = []
        for provider in providers:
            masked_credentials = [
                LLMCredentialResponse(
                    id=cred.id,
                    provider_id=cred.provider_id,
                    user_id=cred.user_id,
                    credential_name=cred.credential_name,
                    encrypted_config=LLMService._mask_secret(cred.encrypted_config),
                    is_valid=cred.is_valid,
                    created_at=cred.created_at,
                    updated_at=cred.updated_at,
                )
                for cred in provider.credentials
            ]

            response_list.append(
                LLMProviderResponse(
                    id=provider.id,
                    user_id=provider.user_id,
                    provider_name=provider.provider_name,
                    provider_type=provider.provider_type,
                    credential_id=provider.credential_id,
                    quota_type=provider.quota_type,
                    quota_limit=provider.quota_limit,
                    quota_used=provider.quota_used,
                    is_valid=provider.is_valid,
                    created_at=provider.created_at,
                    updated_at=provider.updated_at,
                    credentials=masked_credentials,
                )
            )

        print(
            "[llm] providers fetched",
            {
                "count": len(response_list),
                "mode": "shared (no user filter, TODO: per-user later)",
            },
        )
        return response_list

    @staticmethod
    def delete_provider(db: Session, provider_id: uuid.UUID) -> bool:
        """
        provider와 연결된 credential을 함께 삭제합니다.
        - 현재는 사용자 검증 없이 id만으로 삭제 (임시 공유 모드)
        - TODO: 로그인 사용자/권한 검증 추가 필요
        """
        provider = db.query(LLMProvider).filter(LLMProvider.id == provider_id).first()
        if not provider:
            print(
                "[llm] provider delete attempted but not found",
                {"provider_id": str(provider_id)},
            )
            return False

        # FK 충돌 방지를 위해 provider의 credential_id를 먼저 해제
        provider.credential_id = None
        db.add(provider)
        db.flush()

        # 연결된 credential 삭제
        db.query(LLMCredential).filter(LLMCredential.provider_id == provider_id).delete(
            synchronize_session=False
        )
        db.delete(provider)
        db.commit()

        print(
            "[llm] provider deleted",
            {"provider_id": str(provider_id), "mode": "shared (no user filter)"},
        )
        return True

    # === 임시/공유 모드용 LLM 클라이언트 생성 ===
    @staticmethod
    def get_any_provider_client(db: Session):
        """
        TODO: 로그인 사용자별 provider로 제한해야 함.
        현재는 임시/공유 모드: DB에 있는 provider 중 credential이 있는 첫 번째 것을 가져와 클라이언트 생성.
        - 클라이언트는 services.llm_client.factory.get_llm_client 로 생성
        - 자격정보는 복호화 후 credentials dict로 전달
        """
        provider = (
            db.query(LLMProvider)
            .options(joinedload(LLMProvider.credentials))
            .filter(LLMProvider.credential_id.isnot(None))
            .first()
        )
        if not provider or not provider.credentials:
            raise ValueError("사용 가능한 provider/credential이 없습니다. (임시 모드)")

        # 기본 credential 선택 (현재는 첫 번째 사용)
        cred = provider.credentials[0]
        cfg = LLMService._load_credential_config(cred)

        api_key = cfg.get("apiKey") or cfg.get("api_key")
        base_url = cfg.get("baseUrl") or cfg.get("base_url")
        model = cfg.get("model")
        provider_type = (
            cfg.get("providerType") or provider.provider_type or ""
        ).lower()

        if not api_key or not base_url or not model or not provider_type:
            raise ValueError(
                "credential 설정이 부족합니다. (apiKey/baseUrl/model/providerType 필요)"
            )

        client = get_llm_client(
            provider=provider_type,
            model_id=model,
            credentials={"apiKey": api_key, "baseUrl": base_url},
        )

        print(
            "[llm] temp client created",
            {
                "provider_id": str(provider.id),
                "credential_id": str(cred.id),
                "provider_type": provider_type,
                "model": model,
                "mode": "shared (TODO: enforce per-user)",
            },
        )
        return client

    @staticmethod
    def get_default_api_key(db: Session) -> str:
        """
        임시/공유 모드: DB에서 사용 가능한 첫 번째 Provider의 API Key를 반환합니다.
        IngestionService 등에서 Embeddings 초기화 시 사용합니다.
        """
        provider = (
            db.query(LLMProvider)
            .options(joinedload(LLMProvider.credentials))
            .filter(LLMProvider.credential_id.isnot(None))
            .first()
        )
        if not provider or not provider.credentials:
            raise ValueError("사용 가능한 provider/credential이 없습니다. (임시 모드)")

        cred = provider.credentials[0]
        cfg = LLMService._load_credential_config(cred)
        api_key = cfg.get("apiKey") or cfg.get("api_key")

        if not api_key:
            raise ValueError("Credential에 API Key가 없습니다.")

        return api_key
