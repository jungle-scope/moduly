"""
프롬프트 위저드 서비스.
"""

import re
from typing import Literal, Optional, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from apps.gateway.services.llm_service import LLMService
from apps.gateway.utils.template_utils import extract_jinja_variables, format_jinja_variable_list
from apps.shared.db.models.llm import LLMCredential, LLMProvider
from apps.shared.db.models.user import User


WIZARD_SYSTEM_PROMPTS = {
    "system": """당신은 프롬프트 엔지니어링 전문가입니다. 
사용자가 제공한 System Prompt를 분석하고 개선해주세요.

System Prompt의 목적:
- AI의 역할, 성격, 행동 규칙을 정의
- 모든 대화에 일관되게 적용되는 지침

개선 시 고려사항:
1. 명확하고 구체적인 역할 정의
2. 일관된 톤과 스타일 지시
3. 제한사항과 금지 행동 명시
4. 출력 형식 가이드 (필요시)
5. 입력에 있는 {{ 변수명 }}를 삭제하거나 변경하지 말고 그대로 유지하기
6. 입력에 없는 {{ 변수명 }}를 새로 추가하지 않기

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다.""",
    "user": """당신은 프롬프트 엔지니어링 전문가입니다.
사용자가 제공한 User Prompt를 분석하고 개선해주세요.

User Prompt의 목적:
- AI에게 전달하는 구체적인 질문/요청
- 동적 변수를 포함할 수 있음 ({{ 변수명 }} 형식)

개선 시 고려사항:
1. 목표와 기대 결과 명확히 기술
2. 필요한 맥락/배경 정보 포함
3. 출력 형식이나 길이 지정
4. 기존 {{ 변수명 }} 형식 유지
5. 단계별 지시로 복잡한 작업 분해
6. 입력에 있는 {{ 변수명 }}를 삭제하거나 변경하지 말고 그대로 유지하기
7. 입력에 없는 {{ 변수명 }}를 새로 추가하지 않기

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다.""",
    "assistant": """당신은 프롬프트 엔지니어링 전문가입니다.
사용자가 제공한 Assistant Prompt를 분석하고 개선해주세요.

Assistant Prompt의 목적:
- AI 응답의 시작 부분을 미리 지정
- 특정 형식이나 톤으로 응답을 유도

개선 시 고려사항:
1. 자연스러운 시작 문구
2. 원하는 출력 형식 유도
3. 간결하지만 효과적인 프라이밍
4. 입력에 있는 {{ 변수명 }}를 삭제하거나 변경하지 말고 그대로 유지하기
5. 입력에 없는 {{ 변수명 }}를 새로 추가하지 않기

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다.""",
}


_VAR_PATTERN = re.compile(r"{{\s*([^}]+?)\s*}}")


def _normalize_braces(text: str) -> str:
    text = re.sub(r"\{\s+\{", "{{", text)
    text = re.sub(r"\}\s+\}", "}}", text)
    return text


def _strip_unapproved_placeholders(text: str, allowed: Set[str]) -> str:
    def replace(match: re.Match[str]) -> str:
        var_name = match.group(1).strip()
        return match.group(0) if var_name in allowed else ""

    return _VAR_PATTERN.sub(replace, text)


def _build_variable_guardrail(allowed_vars: Set[str]) -> str:
    if allowed_vars:
        allowed_list = format_jinja_variable_list(allowed_vars)
        return (
            "[변수 규칙]\n"
            f"- 허용 변수: {allowed_list}\n"
            "- 위 목록 외 변수는 {{}}로 추가하지 마세요.\n"
            "- 허용 변수의 이름/형식을 변경하지 마세요."
        )
    return "[변수 규칙]\n- 원본 프롬프트에 {{}} 변수가 없으므로 새 변수를 추가하지 마세요."


def _resolve_model_id(
    db: Session,
    user_id: str,
    requested_model_id: Optional[str],
    provider_name: str,
) -> str:
    available_models = LLMService.get_my_available_models(db, user_id)
    allowed_ids = {
        model.model_id_for_api_call
        for model in available_models
        if model.type != "embedding"
    }
    requested = (requested_model_id or "").strip()
    if requested:
        if requested not in allowed_ids:
            raise HTTPException(
                status_code=400,
                detail="선택한 모델을 사용할 수 없습니다. 모델 목록에서 다시 선택해주세요.",
            )
        return requested

    preferred_ids = list(LLMService.EFFICIENT_MODELS.values())
    for preferred_id in preferred_ids:
        if preferred_id in allowed_ids:
            return preferred_id
        prefixed = (
            preferred_id
            if preferred_id.startswith("models/")
            else f"models/{preferred_id}"
        )
        if prefixed in allowed_ids:
            return prefixed

    normalized_provider = provider_name.lower()
    model_id = LLMService.EFFICIENT_MODELS.get(normalized_provider)
    if not model_id:
        raise HTTPException(
            status_code=400,
            detail=(
                f"현재 '{provider_name}'에서는 프롬프트 마법사 기능을 사용할 수 없습니다. "
                "OpenAI, Google, Anthropic Provider를 이용해주세요."
            ),
        )
    return model_id


def check_credentials(db: Session, current_user: User) -> bool:
    credential = (
        db.query(LLMCredential)
        .filter(LLMCredential.user_id == current_user.id, LLMCredential.is_valid == True)
        .first()
    )
    return credential is not None


def _resolve_provider(db: Session, credential: LLMCredential) -> LLMProvider:
    provider = (
        db.query(LLMProvider)
        .filter(LLMProvider.id == credential.provider_id)
        .first()
    )
    if not provider:
        raise HTTPException(status_code=400, detail="Provider 정보를 찾을 수 없습니다.")
    return provider


async def improve_prompt(
    *,
    prompt_type: Literal["system", "user", "assistant"],
    original_prompt: str,
    model_id: Optional[str],
    db: Session,
    current_user: User,
) -> str:
    credential = (
        db.query(LLMCredential)
        .filter(LLMCredential.user_id == current_user.id, LLMCredential.is_valid == True)
        .first()
    )
    if not credential:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "LLM Provider가 등록되지 않았습니다. 설정에서 API Key를 등록해주세요.",
                "credentials_required": True,
            },
        )

    if not original_prompt.strip():
        raise HTTPException(status_code=400, detail="개선할 프롬프트를 입력해주세요.")

    try:
        provider = _resolve_provider(db, credential)
        selected_model_id = _resolve_model_id(
            db, current_user.id, model_id, provider.name
        )
        client = LLMService.get_client_for_user(db, current_user.id, selected_model_id)

        original_vars = extract_jinja_variables(_normalize_braces(original_prompt))
        allowed_vars = original_vars
        system_prompt = WIZARD_SYSTEM_PROMPTS.get(
            prompt_type, WIZARD_SYSTEM_PROMPTS["user"]
        )
        system_prompt = f"{system_prompt}\n\n{_build_variable_guardrail(allowed_vars)}"

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 프롬프트를 개선해주세요:\n\n{original_prompt}",
            },
        ]

        response = await client.invoke(messages, temperature=0.7, max_tokens=2000)
        improved_prompt = (
            response.get("choices", [{}])[0].get("message", {}).get("content", "")
        )
        if not improved_prompt:
            raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")

        improved_prompt = _normalize_braces(improved_prompt)
        improved_prompt = _strip_unapproved_placeholders(improved_prompt, allowed_vars)

        return improved_prompt.strip()

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"프롬프트 개선 중 오류 발생: {str(e)}"
        )
