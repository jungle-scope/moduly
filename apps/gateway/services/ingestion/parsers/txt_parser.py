import logging
from typing import Any, Dict, List

from apps.gateway.services.ingestion.parsers.base import BaseParser

logger = logging.getLogger(__name__)


class TxtParser(BaseParser):
    """
    [TxtParser]
    일반 텍스트(.txt, .md) 파일을 단순히 읽어서 반환합니다.
    인코딩은 기본적으로 utf-8을 시도합니다.
    """

    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        encoding = kwargs.get("encoding", "utf-8")
        try:
            with open(source_path, "r", encoding=encoding) as f:
                content = f.read()

            return [{"text": content, "page": 1}]
        except UnicodeDecodeError:
            # Fallback: cp949 (한국어 윈도우) 시도
            try:
                with open(source_path, "r", encoding="cp949") as f:
                    content = f.read()
                return [{"text": content, "page": 1}]
            except Exception as e:
                logger.error(f"[TxtParser] Encoding fallback failed: {e}")
                return []
        except Exception as e:
            logger.error(f"[TxtParser] Read failed: {e}")
            return []
