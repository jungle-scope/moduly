"""
템플릿 검증 및 토큰 계산 유틸리티
"""

import re
from typing import Dict, Iterable, Set, Tuple

import tiktoken
from jinja2 import Environment, meta


def validate_template(template_str: str, aliases: Dict[str, str]) -> Tuple[bool, str]:
    """
    Jinja2 템플릿 검증

    Args:
        template_str: "{{ 상품명 }}은(는) {{ 가격 }}원"
        aliases: {"product_name": "상품명", "price": "가격"}

    Returns:
        (is_valid, error_message)

    Example:
        >>> validate_template("{{ 상품명 }}", {"product_name": "상품명"})
        (True, "")
        >>> validate_template("{{ 없는필드 }}", {"product_name": "상품명"})
        (False, "Unknown variables: 없는필드")
    """
    try:
        env = Environment()
        ast = env.parse(template_str)

        # 템플릿에서 사용된 변수 추출
        used_vars = meta.find_undeclared_variables(ast)

        # Alias 값들 (사용 가능한 변수)
        available_vars = set(aliases.values())

        # 사용된 변수가 모두 유효한지 확인
        invalid_vars = used_vars - available_vars
        if invalid_vars:
            return False, f"Unknown variables: {', '.join(invalid_vars)}"

        return True, ""

    except Exception as e:
        return False, f"Template syntax error: {str(e)}"


def count_tokens(text: str, model: str = "text-embedding-3-small") -> int:
    """
    텍스트의 토큰 수 계산

    Args:
        text: 토큰을 계산할 텍스트
        model: OpenAI 모델명

    Returns:
        토큰 수

    Example:
        >>> count_tokens("Hello world")
        2
    """
    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        # Fallback: 대략 4자 = 1토큰 (한글 기준)
        return len(text) // 4


_JINJA_VAR_PATTERN = re.compile(r"{{\s*([^{}]+?)\s*}}")


def extract_jinja_variables(text: str) -> Set[str]:
    """
    텍스트에서 Jinja2 변수명을 추출합니다.
    예: "Hello {{ name }}" -> {"name"}
    """
    if not text:
        return set()
    try:
        env = Environment()
        ast = env.parse(text)
        return set(meta.find_undeclared_variables(ast))
    except Exception:
        return {
            match.group(1).strip()
            for match in _JINJA_VAR_PATTERN.finditer(text)
            if match.group(1).strip()
        }


def format_jinja_variable_list(variables: Iterable[str]) -> str:
    """
    변수 목록을 "{{ var }}" 형태로 포맷팅합니다.
    """
    cleaned = sorted({v.strip() for v in variables if v and v.strip()})
    if not cleaned:
        return "(없음)"
    return ", ".join([f"{{{{ {var} }}}}" for var in cleaned])


def find_unregistered_jinja_variables(
    text: str, allowed_variables: Iterable[str]
) -> Set[str]:
    """
    텍스트에 포함된 Jinja2 변수 중 허용되지 않은 변수를 반환합니다.
    """
    allowed_set = {v.strip() for v in allowed_variables if v and v.strip()}
    found = extract_jinja_variables(text)
    return {var for var in found if var not in allowed_set}


def strip_unregistered_jinja_variables(text: str, variables: Iterable[str]) -> str:
    """
    텍스트에서 지정된 Jinja2 변수를 제거합니다.
    """
    if not text:
        return text
    invalid_set = {v.strip() for v in variables if v and v.strip()}
    if not invalid_set:
        return text
    env = Environment()

    def _remove_if_invalid(match: re.Match) -> str:
        expr = match.group(1)
        try:
            ast = env.parse(f"{{{{ {expr} }}}}")
            used_vars = set(meta.find_undeclared_variables(ast))
        except Exception:
            used_vars = {expr.strip()} if expr.strip() else set()
        if used_vars & invalid_set:
            return ""
        return match.group(0)

    return _JINJA_VAR_PATTERN.sub(_remove_if_invalid, text)
