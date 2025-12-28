import json
import uuid
from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from db.models.llm import LLMCredential, LLMProvider
from db.models.user import User
from schemas.llm import (
    LLMCredentialResponse,
    LLMProviderResponse,
    LLMProviderSimpleCreate,
)


class LLMService:
    """
    LLM provider/credential 관련 DB 작업을 담당합니다.
    """

    # 임시 placeholder 사용자 ID (실제 users 테이블에 없으면 FK 에러 날 수 있음)
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
        앞 4글자 + **** + 끝 2글자 형태. 6글자 이하라면 '*' 반복.
        - JSON 문자열이면 apiKey/api_key 필드를 찾아 마스킹 후 JSON 문자열로 반환
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
            encrypted_config=json.dumps(config_payload),  # TODO: 암호화 적용
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
            db.query(LLMProvider)
            .options(joinedload(LLMProvider.credentials))
            .all()
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
        db.query(LLMCredential).filter(
            LLMCredential.provider_id == provider_id
        ).delete(synchronize_session=False)
        db.delete(provider)
        db.commit()

        print(
            "[llm] provider deleted",
            {"provider_id": str(provider_id), "mode": "shared (no user filter)"},
        )
        return True
