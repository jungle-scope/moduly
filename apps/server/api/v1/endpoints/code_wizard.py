"""
코드 위저드 API 엔드포인트.

사용자의 자연어 설명을 기반으로 Code Node에서 실행 가능한 Python 코드를 생성합니다.
"""

from typing import List

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

class CodeGenerateRequest(BaseModel):
    """코드 생성 요청"""
    description: str  # 사용자의 자연어 설명 (예: "두 숫자를 더해서 반환하는 코드")
    input_variables: List[str] = []  # 사용 가능한 입력 변수명 (예: ["num1", "num2"])


class CodeGenerateResponse(BaseModel):
    """코드 생성 응답"""
    generated_code: str


class CredentialCheckResponse(BaseModel):
    """Credential 확인 응답"""
    has_credentials: bool


# === 시스템 프롬프트 ===

CODE_WIZARD_SYSTEM_PROMPT = """당신은 Python 코드 생성 전문가입니다.
사용자의 요구사항을 분석하여 Code Node에서 실행 가능한 Python 코드를 생성해주세요.

[필수 규칙 - 반드시 준수]
1. 반드시 `def main(inputs):` 함수를 정의해야 합니다
2. 입력 변수는 반드시 `inputs['변수명']` 형태로 접근합니다
3. 함수는 반드시 딕셔너리(dict)를 반환해야 합니다 (예: return {"result": value})
4. Python 표준 라이브러리만 사용 가능합니다 (외부 패키지 설치 불가)
5. 외부 네트워크 접근은 불가능합니다 (requests, urllib 등 사용 불가)
6. 파일 I/O는 /tmp 디렉토리만 사용 가능합니다

[사용 가능한 입력 변수]
{input_variables}

[출력 형식]
Python 코드만 출력하세요. 마크다운 코드 블록(```)이나 설명은 불필요합니다.

예시:
def main(inputs):
    val1 = inputs['num1']
    val2 = inputs['num2']
    result = val1 + val2
    return {{"result": result}}"""


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
    credential = db.query(LLMCredential).filter(
        LLMCredential.user_id == current_user.id,
        LLMCredential.is_valid == True
    ).first()
    
    return {"has_credentials": credential is not None}


@router.post("/generate", response_model=CodeGenerateResponse)
def generate_code(
    request: CodeGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    AI를 사용하여 Python 코드를 생성합니다.
    
    사용자의 등록된 LLM credential을 사용하여 코드 생성을 수행합니다.
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
    
    # 2. 설명이 비어있으면 에러
    if not request.description.strip():
        raise HTTPException(
            status_code=400,
            detail="생성할 코드에 대한 설명을 입력해주세요."
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
                detail=f"현재 '{provider.name}'에서는 코드 마법사 기능을 사용할 수 없습니다. OpenAI, Google, Anthropic Provider를 이용해주세요."
            )
        
        client = LLMService.get_client_for_user(db, current_user.id, model_id)
        
        # 4. 입력 변수 목록 포맷팅
        if request.input_variables:
            input_vars_str = "\n".join([f"- {var}" for var in request.input_variables])
        else:
            input_vars_str = "(입력 변수 없음 - inputs 딕셔너리가 비어있을 수 있음)"
        
        # 5. 시스템 프롬프트 구성
        system_prompt = CODE_WIZARD_SYSTEM_PROMPT.format(
            input_variables=input_vars_str
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"다음 기능을 수행하는 Python 코드를 생성해주세요:\n\n{request.description}"}
        ]
        
        # 6. LLM 호출
        response = client.invoke(messages, temperature=0.3, max_tokens=2000)
        
        # 7. 응답 파싱
        generated_code = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if not generated_code:
            raise HTTPException(
                status_code=500,
                detail="AI 응답을 파싱할 수 없습니다."
            )
        
        # 8. 코드 정제 (마크다운 코드 블록 제거)
        generated_code = _clean_code_response(generated_code)
        
        return {"generated_code": generated_code}
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"코드 생성 중 오류 발생: {str(e)}")


def _clean_code_response(code: str) -> str:
    """
    LLM 응답에서 마크다운 코드 블록 태그를 제거합니다.
    """
    code = code.strip()
    
    # ```python 또는 ``` 시작 제거
    if code.startswith("```python"):
        code = code[len("```python"):].strip()
    elif code.startswith("```"):
        code = code[3:].strip()
    
    # ``` 끝 제거
    if code.endswith("```"):
        code = code[:-3].strip()
    
    return code
