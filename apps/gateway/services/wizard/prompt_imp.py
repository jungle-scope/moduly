from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from apps.gateway.services.llm_service import LLMService
from apps.gateway.services.wizard.base import (
    get_valid_credential,
    parse_llm_response,
    select_model,
)

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

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다.""",
}


async def improve_prompt(
    db: Session,
    user_id: int,
    prompt_type: Literal["system", "user", "assistant"],
    original_prompt: str,
) -> str:
    credential = get_valid_credential(db, user_id)
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
        model_id = select_model(
            db, credential, LLMService.EFFICIENT_MODELS, "프롬프트 마법사"
        )
        client = LLMService.get_client_for_user(db, user_id, model_id)

        system_prompt = WIZARD_SYSTEM_PROMPTS.get(
            prompt_type, WIZARD_SYSTEM_PROMPTS["user"]
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 프롬프트를 개선해주세요:\\n\\n{original_prompt}",
            },
        ]

        response = await client.invoke(messages, temperature=0.7, max_tokens=2000)
        improved_prompt = parse_llm_response(response)

        return improved_prompt.strip()

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"프롬프트 개선 중 오류 발생: {str(e)}"
        )
