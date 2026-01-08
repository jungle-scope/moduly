from typing import Any, Dict, List, Optional

from services.ingestion.transformers.base import BaseTransformer
from utils.encryption import encryption_manager


class DbNlTransformer(BaseTransformer):
    """
    [DbNlTransformer]
    DB 조회 결과(Row Dictionary)를 자연어 문장으로 변환합니다.
    검색(RAG) 시 문맥을 이해하기 좋게 포맷팅합니다.

    민감정보 암호화 기능:
    - 사용자가 민감 컬럼으로 지정한 경우 AES 암호화하여 저장
    - 검색 시 복호화되어 LLM에 전달됨
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

        # 민감정보 설정 추출
        sensitive_columns: List[str] = []
        if sensitive_info:
            sensitive_columns = sensitive_info.get("sensitive_columns", [])

        parts = []
        for k, v in input_data.items():
            if v is None:
                continue

            # 민감 컬럼 AES 암호화
            if k in sensitive_columns:
                try:
                    v = encryption_manager.encrypt(str(v))
                except Exception as e:
                    print(f"[ERROR] Failed to encrypt {k}: {e}")
                    # 암호화 실패 시 제외
                    continue

            parts.append(f"{k}: {v}")

        return "\n".join(parts)
