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
2. inputs 딕셔너리에서 변수를 꺼내 사용합니다: `inputs['변수명']`
3. 함수는 반드시 딕셔너리(dict)를 반환해야 합니다
4. 반환값은 JSON 직렬화 가능해야 합니다 (문자열, 숫자, 리스트, 딕셔너리 등)

[실행 환경 - Sandbox]
- Python 3 환경에서 Docker 컨테이너 격리 실행
- 표준 라이브러리 사용 가능: json, re, datetime, math, collections, itertools 등
- 제한: 파일 시스템 접근 불가, 시스템 명령어 실행 불가
- 타임아웃: 기본 10초

[사용 가능한 입력 변수]
{input_variables}

[출력 형식]
Python 코드만 출력하세요. 마크다운 코드 블록(```)이나 설명은 포함하지 마세요.

[예시 1: 기본]
def main(inputs):
    val1 = inputs['num1']
    val2 = inputs['num2']
    result = val1 + val2
    return {{"result": result}}

[예시 2: 문자열 처리]
def main(inputs):
    text = inputs['text']
    return {{
        "upper": text.upper(),
        "length": len(text),
        "words": text.split()
    }}

[예시 3: JSON 파싱]
import json

def main(inputs):
    data = json.loads(inputs['json_str'])
    return {{"parsed": data, "keys": list(data.keys())}}"""


# === Provider별 효율적인 모델 매핑 ===
# 가성비와 코드 생성 능력을 모두 고려한 모델 선정
PROVIDER_EFFICIENT_MODELS = {
    "openai": "gpt-4o-mini",               # 압도적인 가성비 + 준수한 코딩 능력
    "google": "gemini-1.5-flash",          # 매우 저렴 + 긴 컨텍스트
    "anthropic": "claude-3-5-sonnet-20240620", # 코딩 성능 최강자 (Haiku보다 비싸지만 성능 확실)
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
        
        # 7. 응답 파싱 (여러 형식 지원)
        generated_code = ""
        
        # OpenAI 형식: {"choices": [{"message": {"content": "..."}}]}
        if "choices" in response and response["choices"]:
            generated_code = response["choices"][0].get("message", {}).get("content", "")
        # 단순 content 형식
        elif "content" in response:
            generated_code = response["content"]
        # 직접 텍스트 형식
        elif isinstance(response, str):
            generated_code = response
        
        if not generated_code:
            print(f"[code_wizard] Unknown response format: {response}")
            raise HTTPException(
                status_code=500,
                detail="AI 응답을 파싱할 수 없습니다."
            )
        
        # 8. 코드 정제 (마크다운 코드 블록 제거)
        generated_code = _clean_code_response(generated_code)
        
        # 9. 코드 검증 및 자동 수정
        validation_result = _validate_and_fix_code(generated_code)
        if validation_result["has_errors"]:
            # 치명적 에러가 있으면 경고와 함께 반환
            generated_code = validation_result["code"]
            warnings = validation_result["warnings"]
            if warnings:
                # 경고가 있지만 코드는 반환 (프론트에서 표시 가능)
                print(f"[code_wizard] Code warnings: {warnings}")
        else:
            generated_code = validation_result["code"]
        
        return {"generated_code": generated_code}
        
    except ValueError as e:
        print(f"[code_wizard] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[code_wizard] Error: {type(e).__name__}: {e}")
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


def _validate_and_fix_code(code: str) -> dict:
    """
    LLM이 생성한 코드를 검증하고, 가능하면 자동 수정합니다.
    
    자동 수정 항목:
    1. def main(inputs): 함수 정의 없음 → 전체 코드를 main 함수로 래핑
    2. 다른 함수명 사용 → main으로 교체
    3. print() 사용 → return으로 변환
    4. 단순값 return → dict로 래핑
    
    Returns:
        {
            "code": str,           # 수정된 코드
            "has_errors": bool,    # 치명적 에러 여부
            "warnings": List[str]  # 수정/경고 메시지들
        }
    """
    import re
    
    warnings = []
    has_errors = False
    
    # === 1. def main(inputs): 함수 정의 확인 및 수정 ===
    main_pattern = r'def\s+main\s*\(\s*inputs\s*\)\s*:'
    if not re.search(main_pattern, code):
        # 1-1. 다른 함수명으로 정의했는지 확인 (예: def process, def run 등)
        other_func_pattern = r'def\s+(\w+)\s*\(\s*inputs\s*\)\s*:'
        match = re.search(other_func_pattern, code)
        if match:
            old_name = match.group(1)
            # 함수명을 main으로 자동 교체
            code = re.sub(
                rf'def\s+{old_name}\s*\(\s*inputs\s*\)\s*:',
                'def main(inputs):',
                code
            )
            warnings.append(f"✅ 함수명 '{old_name}'을 'main'으로 자동 수정했습니다.")
        else:
            # 1-2. main 함수가 아예 없음 → 전체 코드를 main으로 래핑
            # import 문은 함수 밖에 유지
            lines = code.split('\n')
            import_lines = []
            body_lines = []
            
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('import ') or stripped.startswith('from '):
                    import_lines.append(line)
                else:
                    body_lines.append(line)
            
            # body를 main 함수로 래핑
            if body_lines:
                # 들여쓰기 추가
                indented_body = '\n'.join('    ' + line if line.strip() else '' for line in body_lines)
                
                # return 문이 없으면 마지막에 빈 dict 반환 추가
                if 'return ' not in indented_body and 'return{' not in indented_body:
                    indented_body += '\n    return {"result": "completed"}'
                
                new_code_parts = []
                if import_lines:
                    new_code_parts.append('\n'.join(import_lines))
                new_code_parts.append('\ndef main(inputs):')
                new_code_parts.append(indented_body)
                
                code = '\n'.join(new_code_parts)
                warnings.append("✅ 코드를 'def main(inputs):' 함수로 자동 래핑했습니다.")
    
    # === 2. print()를 return으로 변환 ===
    # 마지막 print 문을 return으로 변경
    # 패턴: print(something) → return {"result": something}
    print_pattern = r'(\s*)print\s*\(([^)]+)\)\s*$'
    
    # 마지막 print만 변환 (여러 개 있으면 마지막 것만)
    matches = list(re.finditer(print_pattern, code, re.MULTILINE))
    if matches and 'return ' not in code:
        last_match = matches[-1]
        indent = last_match.group(1)
        print_content = last_match.group(2).strip()
        
        # print 내용이 dict 형태인지 확인
        if print_content.startswith('{') or print_content.startswith('dict('):
            replacement = f'{indent}return {print_content}'
        else:
            replacement = f'{indent}return {{"result": {print_content}}}'
        
        code = code[:last_match.start()] + replacement + code[last_match.end():]
        warnings.append("✅ 마지막 'print()'를 'return'으로 자동 변환했습니다.")
    
    # === 3. 단순값 return을 dict로 래핑 ===
    # return value → return {"result": value}
    # 단, return {...} 나 return 변수 (변수가 dict일 수 있음)는 제외
    
    # return 문 찾기 (dict가 아닌 리터럴 값만 대상)
    simple_return_pattern = r'(\s*)return\s+(["\'][^"\']+["\']|\d+(?:\.\d+)?|True|False|None)\s*$'
    
    def replace_simple_return(match):
        indent = match.group(1)
        value = match.group(2)
        warnings.append(f"✅ 'return {value}'를 'return {{\"result\": {value}}}'로 자동 래핑했습니다.")
        return f'{indent}return {{"result": {value}}}'
    
    code = re.sub(simple_return_pattern, replace_simple_return, code, flags=re.MULTILINE)
    
    # === 4. 최종 검증: return 문 존재 확인 ===
    if 'return ' not in code and 'return{' not in code:
        warnings.append("⚠️ 'return' 문이 없습니다. 결과를 반환하도록 수정해주세요.")
        has_errors = True
    
    return {
        "code": code,
        "has_errors": has_errors,
        "warnings": warnings
    }
