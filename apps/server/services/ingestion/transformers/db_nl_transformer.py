from typing import Any, Dict, Optional

from services.ingestion.transformers.base import BaseTransformer


class DbNlTransformer(BaseTransformer):
    """
    [DbNlTransformer]
    DB 조회 결과(Row Dictionary)를 자연어 문장으로 변환합니다.
    검색(RAG) 시 문맥을 이해하기 좋게 포맷팅합니다.

    민감정보는 평문으로 반환, 암호화는 service 레이어에서 처리.
    """

    def transform(
        self, input_data: Any, sensitive_info: Optional[Dict[str, Any]] = None, **kwargs
    ) -> str:
        """
        input_data: Dict[str, Any] (예: {"id": 1, "name": "제품A", "price": 1000})
        sensitive_info: {
            "sensitive_columns": ["email", "phone"]
        }
        returns: "id: 1, name: 제품A, price: 1000" 형태의 문자열
        """
        if not isinstance(input_data, dict):
            return str(input_data)

        parts = []
        for k, v in input_data.items():
            if v is None:
                continue

            parts.append(f"{k}: {v}")

        return "\n".join(parts)
