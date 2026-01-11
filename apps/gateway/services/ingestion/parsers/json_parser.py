import json
from typing import Any, Dict, List

from services.ingestion.parsers.base import BaseParser


class JsonParser(BaseParser):
    """
    [JsonParser]
    JSON 응답을 텍스트로 변환합니다.
    특정 필드 매핑 로직을 추가할 수 있습니다.
    """

    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        """
        Args:
            source_path: 여기서는 파일 경로가 아니라 JSON String 또는 Dict 객체일 수 있음.
            kwargs:
                - json_object (dict): 직접 객체 전달 시 사용
        """
        data = kwargs.get("json_object")
        if not data:
            # 파일 경로인 경우 읽기
            try:
                with open(source_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                # source_path가 raw json string인 경우
                try:
                    data = json.loads(source_path)
                except Exception:
                    return []

        # JSON to Text 변환
        # 간단하게 전체를 문자열로 덤프 (나중에 필드 선택 로직 고도화 가능)
        text_content = json.dumps(data, ensure_ascii=False, indent=2)

        return [{"text": text_content, "page": 1}]
