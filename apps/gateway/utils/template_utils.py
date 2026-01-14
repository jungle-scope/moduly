"""
템플릿 검증 및 토큰 계산 유틸리티
"""

from typing import Dict, Tuple

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
