import os
from typing import Any, Dict, List

import pandas as pd

from apps.gateway.services.ingestion.parsers.base import BaseParser


class ExcelCsvParser(BaseParser):
    """
    [ExcelCsvParser]
    Excel(.xlsx) 및 CSV(.csv) 파일을 Pandas를 이용해 마크다운 형태로 변환합니다.
    """

    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        ext = os.path.splitext(source_path)[1].lower()
        chunks = []

        try:
            if ext == ".csv":
                # CSV Chunk processing to avoid OOM
                # 50MB CSV could be huge in markdown
                chunk_size = 500  # Adjust chunk size (rows)
                for i, df_chunk in enumerate(
                    pd.read_csv(source_path, chunksize=chunk_size)
                ):
                    chunk_text = ""
                    if i == 0:
                        chunk_text += (
                            f"# CSV Content: {os.path.basename(source_path)}\n\n"
                        )
                    chunk_text += df_chunk.to_markdown(index=False)
                    chunks.append({"text": chunk_text, "page": i + 1})

            elif ext in [".xlsx", ".xls"]:
                # Sheet-wise processing
                xls = pd.read_excel(source_path, sheet_name=None)
                page_num = 1
                for sheet_name, df in xls.items():
                    # Handle large sheets optimization could be added here
                    sheet_text = f"\n# Sheet: {sheet_name}\n\n"
                    sheet_text += df.to_markdown(index=False)
                    chunks.append({"text": sheet_text, "page": page_num})
                    page_num += 1

            else:
                return []

            return chunks

        except Exception as e:
            print(f"[ExcelCsvParser] Pandas parsing failed: {e}")
            return []
