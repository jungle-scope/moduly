import os
from typing import Any, Dict, List

import pandas as pd

from services.ingestion.parsers.base import BaseParser


class ExcelCsvParser(BaseParser):
    """
    [ExcelCsvParser]
    Excel(.xlsx) 및 CSV(.csv) 파일을 Pandas를 이용해 마크다운 형태로 변환합니다.
    """

    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        ext = os.path.splitext(source_path)[1].lower()
        text_content = ""

        try:
            if ext == ".csv":
                df = pd.read_csv(source_path)
                # DataFrame to Markdown
                text_content += f"# CSV Content: {os.path.basename(source_path)}\n\n"
                text_content += df.to_markdown(index=False)

            elif ext in [".xlsx", ".xls"]:
                # 모든 시트 로드
                xls = pd.read_excel(source_path, sheet_name=None)
                for sheet_name, df in xls.items():
                    text_content += f"\n# Sheet: {sheet_name}\n\n"
                    text_content += df.to_markdown(index=False) + "\n"

            else:
                return []

            # 엑셀/CSV도 단일 페이지 컨텐츠로 취급
            return [{"text": text_content, "page": 1}]

        except Exception as e:
            print(f"[ExcelCsvParser] Pandas parsing failed: {e}")
            return []
