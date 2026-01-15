from typing import Any, Dict, Optional

from apps.shared.services.ingestion.transformers.base import BaseTransformer
from jinja2 import Template, TemplateSyntaxError, UndefinedError


class DbNlTransformer(BaseTransformer):
    """
    [DbNlTransformer]
    DB 조회 결과(Row Dictionary)를 자연어 문장으로 변환합니다.
    Jinja2 템플릿을 지원하여 사용자 정의 포맷으로 변환 가능.

    템플릿이 없으면 key: value 형식으로 fallback.
    """

    def transform(
        self,
        input_data: Any,
        template_str: Optional[str] = None,
        aliases: Optional[Dict[str, str]] = None,
        **kwargs,
    ) -> str:
        """
        Jinja2 템플릿으로 DB row를 자연어로 변환

        Args:
            input_data: {"product_name": "노트북", "price": 1500000}
            template_str: "{{ 상품명 }}은(는) {{ 가격 }}원"
            aliases: {"product_name": "상품명", "price": "가격"}

        Returns:
            "노트북은(는) 1500000원"
        """
        if not isinstance(input_data, dict):
            return str(input_data)

        # Jinja2 템플릿 사용
        if template_str and aliases:
            try:
                # Alias 기반 데이터 매핑
                template_data = {}
                for column, alias in aliases.items():
                    value = input_data.get(column, "")
                    template_data[alias] = value

                # Jinja2 렌더링
                template = Template(template_str)
                result = template.render(**template_data)

                return result.strip()

            except (TemplateSyntaxError, UndefinedError) as e:
                print(f"[ERROR] Template rendering failed: {e}")
                # Fallback to default format

        # Fallback: key: value 형식
        parts = []
        for k, v in input_data.items():
            if v is None:
                continue
            parts.append(f"{k}: {v}")

        return "\n".join(parts)
