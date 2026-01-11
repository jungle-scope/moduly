from typing import Any

from services.ingestion.transformers.base import BaseTransformer


class DbNlTransformer(BaseTransformer):
    """
    [DbNlTransformer]
    DB 조회 결과(Row Dictionary)를 자연어 문장으로 변환합니다.
    검색(RAG) 시 문맥을 이해하기 좋게 포맷팅합니다.
    """

    def transform(self, input_data: Any, **kwargs) -> str:
        """
        input_data: Dict[str, Any] (예: {"id": 1, "name": "제품A", "price": 1000})
        returns: "id: 1, name: 제품A, price: 1000" 형태의 문자열
        """
        if not isinstance(input_data, dict):
            return str(input_data)

        # 1. 포맷팅 템플릿이 있다면 사용 (advanced)
        # 2. 없다면 기본 Key: Value 나열

        parts = []
        for k, v in input_data.items():
            if v is None:
                continue
            parts.append(f"{k}: {v}")

        return "\n".join(parts)
