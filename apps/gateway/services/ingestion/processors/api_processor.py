import logging
from typing import Any, Dict

import requests

from apps.gateway.services.ingestion.parsers.json_parser import JsonParser
from apps.gateway.services.ingestion.processors.base import (
    BaseProcessor,
    ProcessingResult,
)

logger = logging.getLogger(__name__)


class ApiProcessor(BaseProcessor):
    """
    [ApiProcessor]
    HTTP API를 호출하여 데이터를 가져오고 텍스트를 추출합니다.
    """

    def process(self, source_config: Dict[str, Any]) -> ProcessingResult:
        """
        source_config: {
            "url": "http://...",
            "method": "GET",
            "headers": {...},
            "body": {...}
        }
        """
        url = source_config.get("url")
        method = source_config.get("method", "GET")
        headers = source_config.get("headers", {})
        body = source_config.get("body")

        # headers가 JSON string일 수 있으므로 파싱
        if isinstance(headers, str):
            try:
                import json

                headers = json.loads(headers)
            except:
                headers = {}

        # body가 JSON string일 수 있으므로 파싱
        if isinstance(body, str):
            try:
                import json

                body = json.loads(body)
            except:
                body = None

        if not url:
            return ProcessingResult(chunks=[], metadata={"error": "No URL provided"})

        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=body if method != "GET" else None,
                timeout=30,
            )
            response.raise_for_status()

            parser = JsonParser()
            try:
                json_data = response.json()
                # 객체 직접 전달
                parsed_blocks = parser.parse("", json_object=json_data)
            except ValueError:
                # JSON이 아닌 경우 텍스트 그대로 사용
                parsed_blocks = [{"text": response.text, "page": 1}]

            chunks = []
            for block in parsed_blocks:
                chunks.append(
                    {
                        "content": block["text"],
                        "metadata": {"source": url, "page": block["page"]},
                    }
                )

            return ProcessingResult(
                chunks=chunks,
                metadata={"url": url, "status_code": response.status_code},
            )

        except Exception as e:
            logger.error(f"[ApiProcessor] Request failed: {e}")
            return ProcessingResult(chunks=[], metadata={"error": str(e)})
