import os
from abc import ABC, abstractmethod
from typing import Any, Dict, List

import fitz  # PyMuPDF
import httpx
import pandas as pd
from docx import Document as DocxDocument
from llama_parse import LlamaParse


class BaseDataSource(ABC):
    @abstractmethod
    def fetch_text(self, source_config: Dict[str, Any]) -> List[dict]:
        """
        소스에서 텍스트를 추출합니다.

        Args:
            source_config:
            - FILE의 경우: {'file_path': '...', 'document_id': '...'}
            - API의 경우: {'url': '...', 'method': '...', 'headers': '...', 'body': '...'}

        Returns:
            List[dict]: [{'text': '...', 'page': 1, ...}, ...]
        """
        pass

    @abstractmethod
    def estimate_cost(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        예상 비용을 계산합니다.
        Returns:
            {'pages': int, 'credits': int, 'cost_usd': float, 'recommended_strategy': str}
        """
        pass


class FileDataSource(BaseDataSource):
    def fetch_text(self, source_config: Dict[str, Any]) -> List[dict]:
        file_path = source_config.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        strategy = source_config.get("strategy", "auto")

        if ext == ".pdf":
            return self._parse_pdf(file_path, strategy)
        elif ext in [".xlsx", ".xls", ".csv"]:
            return self._parse_excel_csv(file_path)
        elif ext == ".docx":
            return self._parse_docx(file_path)
        elif ext in [".txt", ".md"]:
            return self._parse_txt(file_path)
        else:
            print(f"[Warning] Unsupported file type: {ext}. Trying as text.")
            return self._parse_txt(file_path)

    def estimate_cost(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        file_path = source_config.get("file_path")
        if not file_path or not os.path.exists(file_path):
            return {
                "pages": 0,
                "credits": 0,
                "cost_usd": 0.0,
                "recommended_strategy": "general",
            }

        try:
            # PDF가 아닌 경우 fitz.open()이 실패할 수 있으므로 예외 처리
            ext = os.path.splitext(file_path)[1].lower()
            if ext not in [".pdf", ".xps", ".epub", ".mobi", ".fb2", ".cbz", ".svg"]:
                return {
                    "pages": 0,
                    "credits": 0,
                    "cost_usd": 0.0,
                    "recommended_strategy": "general",
                }

            doc = fitz.open(file_path)
            total_pages = len(doc)
            doc.close()

            # Standard Mode 기준 (페이지당 3 크레딧)
            credits_per_page = 3
            total_credits = total_pages * credits_per_page
            cost_usd = total_credits / 1000.0

            return {
                "pages": total_pages,
                "credits": total_credits,
                "cost_usd": cost_usd,
                "recommended_strategy": "llamaparse" if total_pages > 0 else "general",
            }
        except Exception as e:
            print(f"[Warning] Cost estimation failed: {e}")
            return {
                "pages": 0,
                "credits": 0,
                "cost_usd": 0.0,
                "recommended_strategy": "general",
            }

    def _parse_pdf(self, file_path: str, strategy: str = "auto") -> List[dict]:
        """PDF 파싱 (기존 로직 이관)"""
        text_blocks = []
        try:
            # 1. Force LlamaParse strategy
            if strategy == "llamaparse":
                return self._parse_with_llamaparse(file_path)

            # 2. General / Auto strategy (Try PyMuPDF first)
            doc = fitz.open(file_path)
            is_scanned = True
            for page_num, page in enumerate(doc):
                text = page.get_text()
                if text.strip():
                    is_scanned = False
                    text_blocks.append({"text": text, "page": page_num + 1})
            doc.close()

            # 3. If 'auto' and scanned/empty, fallback to LlamaParse
            if strategy == "auto" and (is_scanned or not text_blocks):
                print("📄 스캔된 PDF 또는 이미지로 감지됨. LlamaParse를 사용합니다.")
                return self._parse_with_llamaparse(file_path)

            return text_blocks
        except Exception as e:
            print(f"PDF parsing failed: {e}")
            return []

    def _parse_with_llamaparse(self, file_path: str) -> List[dict]:
        """LlamaParse 연동 (캐싱 지원)"""

        cache_path = f"{file_path}.md"

        # 캐시 확인
        if os.path.exists(cache_path):
            print(f"📦 Found cached LlamaParse result: {cache_path}")
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    md_text = f.read()
                # 캐시된 파일은 페이지 정보가 합쳐져 있으므로 하나의 블록으로 반환
                return [{"text": md_text, "page": 1}]
            except Exception as e:
                print(f"Failed to read cache: {e}")
                # 읽기 실패 시 재파싱 시도

        try:
            api_key = os.getenv("LLAMA_CLOUD_API_KEY")
            if not api_key:
                print("❌ LLAMA_CLOUD_API_KEY 환경변수가 설정되지 않았습니다.")
                return []

            parser = LlamaParse(
                api_key=api_key,
                result_type="markdown",
                verbose=True,
                language="ko",
                fast_mode=True,
            )

            json_results = parser.get_json_result(file_path)
            parsed_results = []
            full_md_text = ""

            if json_results and isinstance(json_results, list):
                first_result = json_results[0]
                pages = first_result.get("pages", [])
                for p in pages:
                    md_text = p.get("md") or p.get("text") or ""
                    parsed_results.append(
                        {
                            "text": md_text,
                            "page": p["page"],
                        }
                    )
                    full_md_text += md_text + "\n\n"

            # 캐시 저장
            if full_md_text:
                try:
                    with open(cache_path, "w", encoding="utf-8") as f:
                        f.write(full_md_text)
                    print(f"💾 Caved LlamaParse result to: {cache_path}")
                except Exception as e:
                    print(f"Failed to write cache: {e}")

            return parsed_results
        except ImportError:
            print("❌ LlamaParse 라이브러리를 찾을 수 없습니다.")
            return []
        except Exception as e:
            print(f"LlamaParse 처리 실패: {e}")
            return []

    def _parse_excel_csv(self, file_path: str) -> List[dict]:
        """Excel/CSV 파싱"""
        text_content = ""
        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == ".csv":
                df = pd.read_csv(file_path)
                text_content += f"# CSV Content\n\n{df.to_markdown(index=False)}\n"
            else:
                xls = pd.read_excel(file_path, sheet_name=None)
                for sheet_name, df in xls.items():
                    text_content += f"\n# Sheet: {sheet_name}\n\n"
                    text_content += df.to_markdown(index=False) + "\n"
            return [{"text": text_content, "page": 1}]
        except Exception as e:
            print(f"Excel/CSV parsing failed: {e}")
            return []

    def _parse_docx(self, file_path: str) -> List[dict]:
        """Word 파싱"""
        try:
            doc = DocxDocument(file_path)
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text)
            return [{"text": "\n".join(full_text), "page": 1}]
        except Exception as e:
            print(f"DOCX parsing failed: {e}")
            return []

    def _parse_txt(self, file_path: str) -> List[dict]:
        """Text 파싱"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return [{"text": f.read(), "page": 1}]
        except Exception as e:
            print(f"TXT parsing failed: {e}")
            return []


class ApiDataSource(BaseDataSource):
    def fetch_text(self, source_config: Dict[str, Any]) -> List[dict]:
        """
        REST API에서 데이터 추출
        source_config: {
            "url": "...",
            "method": "GET",
            "headers": {...},
            "body": {...},
            "field_mapping": "response.data" # 점 표기법으로 텍스트 위치 지정
        }
        """
        url = source_config.get("url")
        if not url:
            raise ValueError("URL is required for API source")

        method = source_config.get("method", "GET").upper()
        headers = source_config.get("headers", {})
        body = source_config.get("body")

        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.request(method, url, headers=headers, json=body)
                response.raise_for_status()

                data = response.json()

                # TODO: field_mapping을 사용하여 특정 필드만 추출하는 로직 필요
                # 현재는 전체 JSON을 텍스트로 변환
                import json

                text_content = json.dumps(data, ensure_ascii=False, indent=2)

                return [{"text": text_content, "page": 1}]

        except Exception as e:
            print(f"API fetch failed: {e}")
            raise e

    def estimate_cost(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        # API 소스는 현재 비용 예측 로직 없음 (무료로 가정)
        return {
            "pages": 0,
            "credits": 0,
            "cost_usd": 0.0,
            "recommended_strategy": "general",
        }
