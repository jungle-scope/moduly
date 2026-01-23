"""
템플릿 위저드 서비스.
"""

import re
from typing import List, Literal, Optional, Set

from fastapi import HTTPException
from sqlalchemy.orm import Session

from apps.gateway.services.llm_service import LLMService
from apps.shared.db.models.llm import LLMCredential, LLMProvider
from apps.shared.db.models.user import User


COMMON_RULES = """[핵심 규칙 - 반드시 준수]
1. 기존 Jinja2 변수({{ ... }})의 이름과 형식을 절대 수정하거나 삭제하지 마세요
2. 등록된 변수만 사용하세요: {variables}
3. 새로운 변수를 임의로 추가하지 마세요
4. 변수 형식은 반드시 {{ variable_name }} 형태를 유지하세요. (주의: 중괄호 '{{'와 '{{' 사이에는 절대 공백을 넣지 마세요. 예: {{ {{ x }} }} -> 금지)"""

TYPE_SPECIFIC_PROMPTS = {
    "email": """[템플릿 유형: 이메일/알림]
개선 시 고려사항:
- 명확하고 전문적인 인사말/마무리 문구
- 핵심 내용을 간결하게 전달
- 수신자가 필요한 행동(CTA)을 명확히 제시
- 적절한 문단 구분으로 가독성 향상""",
    "message": """[템플릿 유형: 챗봇/알림 메시지]
개선 시 고려사항:
- 간결하고 친근한 톤
- 한눈에 파악 가능한 핵심 정보
- 이모지 적절히 활용 (과하지 않게)
- 모바일에서 읽기 좋은 분량""",
    "report": """[템플릿 유형: 보고서/문서]
개선 시 고려사항:
- 체계적인 구조 (제목, 섹션, 항목)
- 정보의 명확한 전달
- 일관된 형식과 스타일
- 필요시 마크다운 문법 활용""",
    "custom": """[템플릿 유형: 사용자 정의]
사용자의 추가 지시사항을 따르세요:
{custom_instructions}""",
}

WIZARD_SYSTEM_PROMPT_TEMPLATE = """당신은 Jinja2 템플릿 최적화 전문가입니다.
사용자가 제공한 템플릿을 분석하고 개선해주세요.

{common_rules}

{type_specific}

개선된 템플릿만 출력하세요. 설명이나 부연은 불필요합니다."""


PROVIDER_EFFICIENT_MODELS = {
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
    "anthropic": "claude-3-haiku-20240307",
}


_VAR_PATTERN = re.compile(r"{{\s*([^}]+?)\s*}}")


def _normalize_braces(text: str) -> str:
    text = re.sub(r"\{\s+\{", "{{", text)
    text = re.sub(r"\}\s+\}", "}}", text)
    return text


def _extract_placeholders(text: str) -> Set[str]:
    return {
        match.group(1).strip()
        for match in _VAR_PATTERN.finditer(text)
        if match.group(1).strip()
    }


def _strip_unapproved_placeholders(text: str, allowed: Set[str]) -> str:
    def replace(match: re.Match[str]) -> str:
        var_name = match.group(1).strip()
        return match.group(0) if var_name in allowed else ""

    return _VAR_PATTERN.sub(replace, text)


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


async def improve_template(
    *,
    template_type: Literal["email", "message", "report", "custom"],
    original_template: str,
    registered_variables: List[str],
    custom_instructions: Optional[str],
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

    if not original_template.strip():
        raise HTTPException(status_code=400, detail="개선할 템플릿을 입력해주세요.")

    try:
        provider = _resolve_provider(db, credential)
        provider_name = provider.name.lower()
        model_id = PROVIDER_EFFICIENT_MODELS.get(provider_name)
        if not model_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"현재 '{provider.name}'에서는 템플릿 마법사 기능을 사용할 수 없습니다. "
                    "OpenAI, Google, Anthropic Provider를 이용해주세요."
                ),
            )

        client = LLMService.get_client_for_user(db, current_user.id, model_id)

        if registered_variables:
            variables_str = ", ".join([f"{{{{ {v} }}}}" for v in registered_variables])
        else:
            variables_str = "(등록된 변수 없음)"

        common_rules = COMMON_RULES.format(variables=variables_str)
        type_specific = TYPE_SPECIFIC_PROMPTS.get(
            template_type, TYPE_SPECIFIC_PROMPTS["custom"]
        )
        if template_type == "custom":
            custom_instr = custom_instructions or "(추가 지시사항 없음)"
            type_specific = type_specific.format(custom_instructions=custom_instr)

        system_prompt = WIZARD_SYSTEM_PROMPT_TEMPLATE.format(
            common_rules=common_rules, type_specific=type_specific
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 템플릿을 개선해주세요:\n\n{original_template}",
            },
        ]

        response = await client.invoke(messages, temperature=0.7, max_tokens=2000)
        improved_template = (
            response.get("choices", [{}])[0].get("message", {}).get("content", "")
        )
        if not improved_template:
            raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")

        allowed_vars = _extract_placeholders(_normalize_braces(original_template))
        improved_template = _normalize_braces(improved_template)
        improved_template = _strip_unapproved_placeholders(
            improved_template, allowed_vars
        )

        return improved_template.strip()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"템플릿 개선 중 오류 발생: {str(e)}"
        )
