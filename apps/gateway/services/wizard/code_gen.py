import logging
import re
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from apps.gateway.services.llm_service import LLMService
from apps.gateway.services.wizard.base import (
    get_valid_credential,
    parse_llm_response,
    select_model,
)

logger = logging.getLogger(__name__)

CODE_WIZARD_SYSTEM_PROMPT = """당신은 Python 코드 생성 전문가입니다.
사용자의 요구사항을 분석하여 Code Node에서 실행 가능한 Python 코드를 생성해주세요.

[필수 규칙 - 반드시 준수]
1. 반드시 `def main(inputs):` 함수를 정의해야 합니다
2. inputs 딕셔너리에서 변수를 꺼내 사용합니다: `inputs['변수명']`
3. **main() 함수만** 딕셔너리(dict)를 반환해야 합니다
4. **중요**: main()의 반환 딕셔너리 키는 반드시 "result"를 사용: `return {{"result": 값}}`
5. **중요**: 헬퍼 함수는 일반 값(boolean, int, str 등)을 반환해야 합니다 (dict 아님!)
6. 반환값은 JSON 직렬화 가능해야 합니다 (문자열, 숫자, 리스트, 딕셔너리 등)

[타입 안전성 - 반드시 지켜야 할 주의사항]
- inputs에서 가져온 값의 타입을 항상 명시적으로 변환하세요
- 숫자 연산 시: `int(inputs['num'])` 또는 `float(inputs['num'])`
- 문자열 메서드(len, split, endswith 등) 사용 시: `str(inputs['value'])`
- 타입 변환 없이 사용하면 런타임 에러가 발생할 수 있습니다!

[실행 환경 - Sandbox]
- Python 3 환경에서 Docker 컨테이너 격리 실행
- 표준 라이브러리 사용 가능: json, re, datetime, math, collections, itertools 등
- 제한: 파일 시스템 접근 불가, 시스템 명령어 실행 불가
- 타임아웃: 기본 10초 (무한 루프 주의!)

[사용 가능한 입력 변수]
{input_variables}

[출력 형식]
Python 코드만 출력하세요. 마크다운 코드 블록(```)이나 설명은 포함하지 마세요.
**중요**: main() 함수만 `return {{"result": 값}}` 형식으로 반환하세요.

[예시 1: 기본 연산 - 타입 변환 필수]
def main(inputs):
    # 숫자 연산 시 int()로 명시적 변환
    val1 = int(inputs['num1'])
    val2 = int(inputs['num2'])
    total = val1 + val2
    return {{"result": total}}

[예시 2: 문자열 처리 - 타입 변환 필수]
def main(inputs):
    # 문자열 메서드 사용 시 str()로 명시적 변환
    text = str(inputs['text'])
    processed = {{
        "upper": text.upper(),
        "length": len(text),
        "words": text.split()
    }}
    return {{"result": processed}}

[예시 3: 헬퍼 함수 사용 (매우 중요!)]
def is_prime(n):
    # 헬퍼 함수는 boolean/int/str 등 일반 값 반환 (절대 dict 아님!)
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def main(inputs):
    num = int(inputs['num'])  # 명시적 타입 변환
    # 헬퍼 함수가 boolean을 반환하므로 조건문 정상 작동
    if is_prime(num):
        return {{"result": f"{{num}}은(는) 소수입니다"}}
    return {{"result": f"{{num}}은(는) 소수가 아닙니다"}}

[예시 4: 접미사로 끝나는 숫자 찾기]
def is_prime(n):
    # 헬퍼 함수는 boolean 반환
    if n <= 1:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True

def main(inputs):
    # 접미사는 문자열로 변환하여 처리
    suffix = str(inputs['suffix'])
    # 후보 숫자를 순회하며 접미사로 끝나는 소수 찾기
    for candidate in range(1, 100000):
        if str(candidate).endswith(suffix) and is_prime(candidate):
            return {{"result": candidate}}
    return {{"result": None}}"""

CODE_PROVIDER_EFFICIENT_MODELS = {
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
    "anthropic": "claude-3-5-sonnet-20240620",
}


async def generate_code(
    db: Session, user_id: int, description: str, input_variables: List[str]
) -> str:
    # 1. 유효한 credential 확인
    credential = get_valid_credential(db, user_id)
    if not credential:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "LLM Provider가 등록되지 않았습니다. 설정에서 API Key를 등록해주세요.",
                "credentials_required": True,
            },
        )

    # 2. 설명 검증
    if not description.strip():
        raise HTTPException(
            status_code=400, detail="생성할 코드에 대한 설명을 입력해주세요."
        )

    try:
        # 3. Provider/Model 선택
        model_id = select_model(
            db, credential, CODE_PROVIDER_EFFICIENT_MODELS, "코드 마법사"
        )
        client = LLMService.get_client_for_user(db, user_id, model_id)

        # 4. 입력 변수 목록 포맷팅
        if input_variables:
            input_vars_str = "\\n".join([f"- {var}" for var in input_variables])
        else:
            input_vars_str = "(입력 변수 없음 - inputs 딕셔너리가 비어있을 수 있음)"

        # 5. 시스템 프롬프트 구성
        system_prompt = CODE_WIZARD_SYSTEM_PROMPT.format(input_variables=input_vars_str)

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"다음 기능을 수행하는 Python 코드를 생성해주세요:\\n\\n{description}",
            },
        ]

        # 6. LLM 호출
        response = await client.invoke(messages, temperature=0.3, max_tokens=2000)

        # 7. 응답 파싱
        generated_code = parse_llm_response(response)

        # 8. 코드 정제
        generated_code = _clean_code_response(generated_code)

        # 9. 코드 검증 및 자동 수정
        validation_result = _validate_and_fix_code(generated_code)
        if validation_result["has_errors"]:
            generated_code = validation_result["code"]
            warnings = validation_result["warnings"]
            if warnings:
                logger.warning(f"Code warnings: {warnings}")
        else:
            generated_code = validation_result["code"]

        return generated_code

    except ValueError as e:
        logger.error(f"ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"코드 생성 중 오류 발생: {str(e)}")


def _clean_code_response(code: str) -> str:
    code = code.strip()
    if code.startswith("```python"):
        code = code[len("```python") :].strip()
    elif code.startswith("```"):
        code = code[3:].strip()
    if code.endswith("```"):
        code = code[:-3].strip()
    return code


def _validate_and_fix_code(code: str) -> dict:
    warnings = []
    has_errors = False

    # 1. def main(inputs): definition
    main_pattern = r"def\\s+main\\s*\\(\\s*inputs\\s*\\)\\s*:"
    if not re.search(main_pattern, code):
        other_func_pattern = r"def\\s+(\\w+)\\s*\\(\\s*inputs\\s*\\)\\s*:"
        match = re.search(other_func_pattern, code)
        if match:
            old_name = match.group(1)
            code = re.sub(
                rf"def\\s+{old_name}\\s*\\(\\s*inputs\\s*\\)\\s*:",
                "def main(inputs):",
                code,
            )
            warnings.append(f"✅ 함수명 '{old_name}'을 'main'으로 자동 수정했습니다.")
        else:
            lines = code.split("\\n")
            import_lines = []
            body_lines = []

            for line in lines:
                stripped = line.strip()
                if stripped.startswith("import ") or stripped.startswith("from "):
                    import_lines.append(line)
                else:
                    body_lines.append(line)

            if body_lines:
                indented_body = "\\n".join(
                    "    " + line if line.strip() else "" for line in body_lines
                )
                if "return " not in indented_body and "return{" not in indented_body:
                    indented_body += '\\n    return {"result": "completed"}'

                new_code_parts = []
                if import_lines:
                    new_code_parts.append("\\n".join(import_lines))
                new_code_parts.append("\\ndef main(inputs):")
                new_code_parts.append(indented_body)

                code = "\\n".join(new_code_parts)
                warnings.append(
                    "✅ 코드를 'def main(inputs):' 함수로 자동 래핑했습니다."
                )

    # 2. print() to return
    print_pattern = r"(\\s*)print\\s*\\(([^)]+)\\)\\s*$"
    matches = list(re.finditer(print_pattern, code, re.MULTILINE))
    if matches and "return " not in code:
        last_match = matches[-1]
        indent = last_match.group(1)
        print_content = last_match.group(2).strip()

        if print_content.startswith("{") or print_content.startswith("dict("):
            replacement = f"{indent}return {print_content}"
        else:
            replacement = f'{indent}return {{"result": {print_content}}}'

        code = code[: last_match.start()] + replacement + code[last_match.end() :]
        warnings.append("✅ 마지막 'print()'를 'return'으로 자동 변환했습니다.")

    # 3. simple return to dict wrapping
    simple_return_pattern = (
        r'(\\s*)return\\s+(["\'][^"\']+["\']|\\d+(?:\\.\\d+)?|True|False|None)\\s*$'
    )

    def replace_simple_return(match):
        indent = match.group(1)
        value = match.group(2)
        warnings.append(
            f"✅ 'return {value}'를 'return {{\"result\": {value}}}'로 자동 래핑했습니다."
        )
        return f'{indent}return {{"result": {value}}}'

    code = re.sub(
        simple_return_pattern, replace_simple_return, code, flags=re.MULTILINE
    )

    # 4. Check for return
    if "return " not in code and "return{" not in code:
        warnings.append("⚠️ 'return' 문이 없습니다. 결과를 반환하도록 수정해주세요.")
        has_errors = True

    return {"code": code, "has_errors": has_errors, "warnings": warnings}
