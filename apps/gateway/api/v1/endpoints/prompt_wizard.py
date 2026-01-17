"""
프롬프트 위저드 API 엔드포인트.

사용자의 프롬프트를 AI가 개선해주는 기능을 제공합니다.
"""

from typing import Literal, Set

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.gateway.auth.dependencies import get_current_user
from apps.shared.db.models.llm import LLMCredential, LLMProvider
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db
from apps.gateway.services.llm_service import LLMService
from apps.gateway.utils.template_utils import (
    extract_jinja_variables,
    find_unregistered_jinja_variables,
    format_jinja_variable_list,
    strip_unregistered_jinja_variables,
)

router = APIRouter()


# === Request/Response Schemas ===


class PromptImproveRequest(BaseModel):
    """프롬프트 개선 요청"""

    prompt_type: Literal["system", "user", "assistant"]
    original_prompt: str


class PromptImproveResponse(BaseModel):
    """프롬프트 개선 응답"""

    improved_prompt: str


class CredentialCheckResponse(BaseModel):
    """Credential 확인 응답"""

    has_credentials: bool


# === 시스템 프롬프트 템플릿 ===

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
5. 원본에 포함된 {{ 변수명 }} 이외의 새로운 변수를 추가하지 마세요

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
5. 원본에 포함된 {{ 변수명 }} 이외의 새로운 변수를 추가하지 마세요
6. 단계별 지시로 복잡한 작업 분해

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
4. 원본에 포함된 {{ 변수명 }} 이외의 새로운 변수를 추가하지 마세요

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다.""",
}

# === Provider별 효율적인 모델 매핑 ===
# LLMService.EFFICIENT_MODELS 참조


# === Endpoints ===


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


def _build_retry_message(
    allowed_vars: Set[str], invalid_vars: Set[str], candidate_text: str
) -> str:
    allowed_list = format_jinja_variable_list(allowed_vars)
    invalid_list = format_jinja_variable_list(invalid_vars)
    return (
        "아래 결과에 등록되지 않은 변수가 포함되어 있습니다.\n"
        f"- 허용 변수: {allowed_list}\n"
        f"- 발견된 변수: {invalid_list}\n"
        "허용 변수만 사용해서 아래 결과를 수정한 뒤 프롬프트만 출력하세요.\n\n"
        f"[기존 결과]\n{candidate_text}"
    )


@router.get("/check-credentials", response_model=CredentialCheckResponse)
def check_credentials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    현재 사용자가 유효한 LLM credential을 가지고 있는지 확인합니다.
    """
    credential = (
        db.query(LLMCredential)
        .filter(
            LLMCredential.user_id == current_user.id, LLMCredential.is_valid == True
        )
        .first()
    )

    return {"has_credentials": credential is not None}


@router.post("/improve", response_model=PromptImproveResponse)
def improve_prompt(
    request: PromptImproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 프롬프트를 개선합니다.

    사용자의 등록된 LLM credential을 사용하여 프롬프트 개선을 수행합니다.
    credential이 없으면 400 에러를 반환합니다.
    """
    # 1. 유효한 credential 확인
    credential = (
        db.query(LLMCredential)
        .filter(
            LLMCredential.user_id == current_user.id, LLMCredential.is_valid == True
        )
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

    # 2. 원본 프롬프트가 비어있으면 에러
    # (최후의최후의최후 방어: 프론트에서 버튼 disabled로 이미 막아둠)
    if not request.original_prompt.strip():
        raise HTTPException(status_code=400, detail="개선할 프롬프트를 입력해주세요.")

    try:
        # 3. Provider 정보 조회 후 효율적인 모델 선택
        provider = (
            db.query(LLMProvider)
            .filter(LLMProvider.id == credential.provider_id)
            .first()
        )

        if not provider:
            raise HTTPException(
                status_code=400, detail="Provider 정보를 찾을 수 없습니다."
            )

        provider_name = provider.name.lower()
        model_id = LLMService.EFFICIENT_MODELS.get(provider_name)

        if not model_id:
            raise HTTPException(
                status_code=400,
                detail=f"현재 '{provider.name}'에서는 프롬프트 마법사 기능을 사용할 수 없습니다. OpenAI, Google, Anthropic Provider를 이용해주세요.",
            )

        client = LLMService.get_client_for_user(db, current_user.id, model_id)

        # 4. 메시지 구성
        allowed_vars = extract_jinja_variables(request.original_prompt)
        system_prompt = WIZARD_SYSTEM_PROMPTS.get(
            request.prompt_type, WIZARD_SYSTEM_PROMPTS["user"]
        )
        system_prompt = f"{system_prompt}\n\n{_build_variable_guardrail(allowed_vars)}"

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 프롬프트를 개선해주세요:\n\n{request.original_prompt}",
            },
        ]

        # 5. LLM 호출
        response = client.invoke(messages, temperature=0.7, max_tokens=2000)

        # 6. 응답 파싱
        improved_prompt = (
            response.get("choices", [{}])[0].get("message", {}).get("content", "")
        )

        if not improved_prompt:
            raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")

        improved_prompt = improved_prompt.strip()
        invalid_vars = find_unregistered_jinja_variables(improved_prompt, allowed_vars)

        if invalid_vars:
            retry_message = _build_retry_message(
                allowed_vars, invalid_vars, improved_prompt
            )
            retry_messages = messages + [{"role": "user", "content": retry_message}]
            response = client.invoke(retry_messages, temperature=0.2, max_tokens=2000)
            improved_prompt = (
                response.get("choices", [{}])[0].get("message", {}).get("content", "")
            )
            if not improved_prompt:
                raise HTTPException(
                    status_code=500, detail="AI 응답을 파싱할 수 없습니다."
                )
            improved_prompt = improved_prompt.strip()
            invalid_vars = find_unregistered_jinja_variables(
                improved_prompt, allowed_vars
            )

        if invalid_vars:
            improved_prompt = strip_unregistered_jinja_variables(
                improved_prompt, invalid_vars
            ).strip()
            invalid_vars = find_unregistered_jinja_variables(
                improved_prompt, allowed_vars
            )
            if invalid_vars:
                improved_prompt = strip_unregistered_jinja_variables(
                    improved_prompt, invalid_vars
                ).strip()

        return {"improved_prompt": improved_prompt}

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"프롬프트 개선 중 오류 발생: {str(e)}"
        )
