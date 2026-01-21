import logging
from typing import Any, Dict, Optional

from apps.shared.services.ingestion.transformers.base import BaseTransformer
from jinja2 import Template, TemplateSyntaxError, UndefinedError

logger = logging.getLogger(__name__)


class DbNlTransformer(BaseTransformer):
    """
    [DbNlTransformer]
    DB 조회 결과(Row Dictionary)를 자연어 문장으로 변환합니다.
    Jinja2 템플릿을 지원하여 사용자 정의 포맷으로 변환 가능.

    - 단일 테이블: {col: val} + table_name → {{table.column}} 접근 가능
    - JOIN 모드: {table: {col: val}} 구조 직접 지원

    템플릿이 없으면 선택된 컬럼만 key: value 형식으로 fallback.
    """

    def transform(
        self,
        input_data: Any,
        template_str: Optional[str] = None,
        table_name: Optional[str] = None,
        **kwargs,
    ) -> str:
        """
        Jinja2 템플릿으로 DB row를 자연어로 변환

        Args:
            input_data: 단일 테이블 {"sku": "A001", "quantity": 10}
                       또는 JOIN 모드 {"inventory": {"sku": "A001"}, "product": {"name": "상품A"}}
            template_str: "{{inventory.sku}} 상품" 또는 None
            table_name: 단일 테이블 모드에서 테이블명 (예: "inventory")

        Returns:
            템플릿이 있으면 렌더링 결과, 없으면 key: value 형식
        """
        if not isinstance(input_data, dict):
            return str(input_data)

        # 1. 네임스페이스 구조로 정규화
        if table_name and not self._is_namespaced(input_data):
            # 단일 테이블: {col: val} → {table: {col: val}}
            namespaced_data = {table_name: input_data}
        else:
            # JOIN: 이미 {table: {col: val}} 구조
            namespaced_data = input_data

        # 2. 템플릿 렌더링
        if template_str:
            try:
                template = Template(template_str)
                result = template.render(**namespaced_data)
                return result.strip()
            except (TemplateSyntaxError, UndefinedError) as e:
                logger.error(f"Template rendering failed: {e}")
                # Fallback (아래)

        # 3. Fallback: 선택된 컬럼만 key: value 형식
        return self._format_as_key_value(namespaced_data)

    def _is_namespaced(self, data: dict) -> bool:
        """
        첫 번째 value가 dict인지 확인하여 JOIN 구조 여부 판별
        """
        if not data:
            return False
        first_val = next(iter(data.values()))
        return isinstance(first_val, dict)

    def _format_as_key_value(self, namespaced_data: dict) -> str:
        """
        테이블별 key: value 포맷으로 변환
        """
        parts = []
        for table, cols in namespaced_data.items():
            if isinstance(cols, dict):
                for k, v in cols.items():
                    if v is not None:
                        parts.append(f"{k}: {v}")
            else:
                # 단일 값인 경우 (예외 처리)
                if cols is not None:
                    parts.append(f"{table}: {cols}")
        return "\n".join(parts)

