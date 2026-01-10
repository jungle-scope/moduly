"""
프롬프트 위저드 API 엔드포인트.

사용자의 프롬프트를 AI가 개선해주는 기능을 제공합니다.
"""

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_current_user
from db.models.llm import LLMCredential, LLMProvider
from db.models.user import User
from db.session import get_db
from services.llm_service import LLMService

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

개선된 프롬프트만 출력하세요. 설명이나 부연은 불필요합니다."""
}

# === Provider별 효율적인 모델 매핑 ===
# 각 Provider에서 프롬프트 개선 작업에 적합한 가성비 모델 선택
PROVIDER_EFFICIENT_MODELS = {
    "openai": "gpt-4o-mini",       # 백업: gpt-3.5-turbo
    "google": "gemini-1.5-flash",  # 백업: gemini-1.0-pro
    "anthropic": "claude-3-haiku-20240307",  # 백업: claude-3-sonnet
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
    credential = db.query(LLMCredential).filter(
        LLMCredential.user_id == current_user.id,
        LLMCredential.is_valid == True
    ).first()
    
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
    credential = db.query(LLMCredential).filter(
        LLMCredential.user_id == current_user.id,
        LLMCredential.is_valid == True
    ).first()
    
    if not credential:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "LLM Provider가 등록되지 않았습니다. 설정에서 API Key를 등록해주세요.",
                "credentials_required": True
            }
        )
    
    # 2. 원본 프롬프트가 비어있으면 에러
    # (최후의최후의최후 방어: 프론트에서 버튼 disabled로 이미 막아둠)
    if not request.original_prompt.strip():
        raise HTTPException(
            status_code=400,
            detail="개선할 프롬프트를 입력해주세요."
        )
    
    try:
        # 3. Provider 정보 조회 후 효율적인 모델 선택
        provider = db.query(LLMProvider).filter(
            LLMProvider.id == credential.provider_id
        ).first()
        
        if not provider:
            raise HTTPException(
                status_code=400,
                detail="Provider 정보를 찾을 수 없습니다."
            )
        
        provider_name = provider.name.lower()
        model_id = PROVIDER_EFFICIENT_MODELS.get(provider_name)
        
        if not model_id:
            raise HTTPException(
                status_code=400,
                detail=f"현재 '{provider.name}'에서는 프롬프트 마법사 기능을 사용할 수 없습니다. OpenAI, Google, Anthropic Provider를 이용해주세요."
            )
        
        client = LLMService.get_client_for_user(db, current_user.id, model_id)
        
        # 4. 메시지 구성
        system_prompt = WIZARD_SYSTEM_PROMPTS.get(
            request.prompt_type, 
            WIZARD_SYSTEM_PROMPTS["user"]
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"다음 프롬프트를 개선해주세요:\n\n{request.original_prompt}"}
        ]
        
        # 5. LLM 호출
        response = client.invoke(messages, temperature=0.7, max_tokens=2000)
        
        # 6. 응답 파싱
        improved_prompt = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if not improved_prompt:
            raise HTTPException(
                status_code=500,
                detail="AI 응답을 파싱할 수 없습니다."
            )
        
        return {"improved_prompt": improved_prompt.strip()}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"프롬프트 개선 중 오류 발생: {str(e)}")
