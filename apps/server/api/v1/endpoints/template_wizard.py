"""
템플릿 위저드 API 엔드포인트.

사용자의 Jinja2 템플릿을 AI가 개선해주는 기능을 제공합니다.
핵심: 기존 변수({{ ... }})를 보존하면서 템플릿 품질을 향상시킵니다.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from apps.shared.db.models.llm import LLMCredential, LLMProvider
from apps.shared.db.models.user import User
from apps.shared.db.session import get_db
from services.llm_service import LLMService

router = APIRouter()


# === Request/Response Schemas ===


class TemplateImproveRequest(BaseModel):
    """템플릿 개선 요청"""

    template_type: Literal["email", "message", "report", "custom"]
    original_template: str
    registered_variables: List[str] = []  # 예: ["user_name", "order_id"]
    custom_instructions: Optional[str] = None  # custom 타입일 때 사용


class TemplateImproveResponse(BaseModel):
    """템플릿 개선 응답"""

    improved_template: str


class CredentialCheckResponse(BaseModel):
    """Credential 확인 응답"""

    has_credentials: bool


# === 시스템 프롬프트 템플릿 ===

# 공통 규칙 (모든 타입에 적용)
COMMON_RULES = """[핵심 규칙 - 반드시 준수]
1. 기존 Jinja2 변수({{{{ ... }}}})의 이름과 형식을 절대 수정하거나 삭제하지 마세요
2. 등록된 변수만 사용하세요: {variables}
3. 새로운 변수를 임의로 추가하지 마세요
4. 변수 형식은 반드시 {{{{ variable_name }}}} 형태를 유지하세요. (주의: 중괄호 '{{'와 '{{' 사이에는 절대 공백을 넣지 마세요. 예: {{ {{ x }} }} -> 금지)"""

# 타입별 개선 지침
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

# 메인 시스템 프롬프트 템플릿
WIZARD_SYSTEM_PROMPT_TEMPLATE = """당신은 Jinja2 템플릿 최적화 전문가입니다.
사용자가 제공한 템플릿을 분석하고 개선해주세요.

{common_rules}

{type_specific}

개선된 템플릿만 출력하세요. 설명이나 부연은 불필요합니다."""


# === Provider별 효율적인 모델 매핑 ===
PROVIDER_EFFICIENT_MODELS = {
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
    "anthropic": "claude-3-haiku-20240307",
}


# === Endpoints ===


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


@router.post("/improve", response_model=TemplateImproveResponse)
def improve_template(
    request: TemplateImproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 Jinja2 템플릿을 개선합니다.

    사용자의 등록된 LLM credential을 사용하여 템플릿 개선을 수행합니다.
    등록된 변수는 반드시 보존됩니다.
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

    # 2. 원본 템플릿이 비어있으면 에러
    if not request.original_template.strip():
        raise HTTPException(status_code=400, detail="개선할 템플릿을 입력해주세요.")

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
        model_id = PROVIDER_EFFICIENT_MODELS.get(provider_name)

        if not model_id:
            raise HTTPException(
                status_code=400,
                detail=f"현재 '{provider.name}'에서는 템플릿 마법사 기능을 사용할 수 없습니다. OpenAI, Google, Anthropic Provider를 이용해주세요.",
            )

        client = LLMService.get_client_for_user(db, current_user.id, model_id)

        # 4. 변수 목록 포맷팅
        if request.registered_variables:
            variables_str = ", ".join(
                [f"{{{{ {v} }}}}" for v in request.registered_variables]
            )
        else:
            variables_str = "(등록된 변수 없음)"

        # 5. 시스템 프롬프트 구성
        common_rules = COMMON_RULES.format(variables=variables_str)

        type_specific = TYPE_SPECIFIC_PROMPTS.get(
            request.template_type, TYPE_SPECIFIC_PROMPTS["custom"]
        )

        # custom 타입일 때 사용자 지시사항 삽입
        if request.template_type == "custom":
            custom_instr = request.custom_instructions or "(추가 지시사항 없음)"
            type_specific = type_specific.format(custom_instructions=custom_instr)

        system_prompt = WIZARD_SYSTEM_PROMPT_TEMPLATE.format(
            common_rules=common_rules, type_specific=type_specific
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 템플릿을 개선해주세요:\n\n{request.original_template}",
            },
        ]

        # 6. LLM 호출
        response = client.invoke(messages, temperature=0.7, max_tokens=2000)

        # 7. 응답 파싱
        improved_template = (
            response.get("choices", [{}])[0].get("message", {}).get("content", "")
        )

        if not improved_template:
            raise HTTPException(status_code=500, detail="AI 응답을 파싱할 수 없습니다.")

        # [Safety Logic] Jinja2 구문 오류 자동 수정
        # LLM이 간혹 '{ { variable } }' 처럼 중괄호 사이에 공백을 넣는 경우가 있음
        import re

        # 1. 여는 중괄호 수정: '{ {' -> '{{'
        improved_template = re.sub(r"\{\s+\{", "{{", improved_template)
        # 2. 닫는 중괄호 수정: '} }' -> '}}'
        improved_template = re.sub(r"\}\s+\}", "}}", improved_template)

        return {"improved_template": improved_template.strip()}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[template_wizard] Error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, detail=f"템플릿 개선 중 오류 발생: {str(e)}"
        )
