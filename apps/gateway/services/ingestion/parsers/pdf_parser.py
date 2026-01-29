import logging
from enum import Enum
from typing import Any, Dict, List

import fitz  # PyMuPDF
import pymupdf4llm

from apps.gateway.services.ingestion.parsers.base import BaseParser

logger = logging.getLogger(__name__)


class ParsingStrategy(str, Enum):
    TEXT = "text"
    MIXED = "mixed"
    IMAGE = "image"


class PdfParser(BaseParser):
    """
    [PdfParser]
    PDF 파일을 처리하여 텍스트를 추출하는 파서입니다.

    기능:
    1. PyMuPDF(pymupdf4llm)를 사용한 빠른 마크다운 변환
    2. LlamaParse를 사용한 고품질 변환 (OCR 포함)
    3. 파일 성격(이미지 비중 등)에 따른 분석 및 전략 제안 기능
    """

    def parse(self, source_path: str, **kwargs) -> List[Dict[str, Any]]:
        """
        PDF 파싱 메인 메서드

        Args:
            source_path: PDF 파일의 절대 경로
            kwargs:
                - strategy (str): 'general' (기본값) 또는 'llamaparse'
                - api_key (str): LlamaParse API Key (llamaparse 전략 사용 시 필수)
                - target_pages (str): 파싱할 페이지 범위 (예: "0-4", llamaparse 전용)

        Returns:
            [{"text": "...", "page": 1}, ...]
        """
        strategy = kwargs.get("strategy", "general")
        target_pages = kwargs.get("target_pages")

        if strategy == "llamaparse":
            api_key = kwargs.get("api_key")
            if not api_key:
                raise ValueError("LlamaParse strategy requires 'api_key'")
            return self._parse_with_llamaparse(source_path, api_key, target_pages)
        else:
            return self._parse_with_pymupdf(source_path)

    def analyze(self, file_path: str) -> Dict[str, Any]:
        """
        PDF 파일의 페이지 수를 반환합니다.
        전략은 사용자가 UI에서 직접 선택합니다.
        """
        doc = fitz.open(file_path)
        total_pages = len(doc)
        doc.close()

        return {
            "pages": total_pages,
        }

    def _parse_with_pymupdf(self, file_path: str) -> List[Dict[str, Any]]:
        """PyMuPDF4LLM을 사용하여 빠르게 마크다운 텍스트 추출"""
        try:
            md_text_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)

            # 구분선(-----)만 있고 실제 텍스트가 없는 경우 감지
            total_content_len = 0
            for chunk in md_text_chunks:
                clean_text = chunk["text"].replace("-", "").strip()
                total_content_len += len(clean_text)

            if total_content_len < 20:  # 텍스트가 거의 없다고 판단
                return self._parse_with_fitz_fallback(file_path)

            results = []
            for chunk in md_text_chunks:
                text_content = chunk["text"]
                results.append(
                    {"text": text_content, "page": chunk["metadata"]["page"] + 1}
                )
            return results
        except Exception as e:
            logger.error(f"[PdfParser] PyMuPDF failed: {e}")
            return self._parse_with_fitz_fallback(file_path)

    def _parse_with_fitz_fallback(self, file_path: str) -> List[Dict[str, Any]]:
        """Standard PyMuPDF text extraction as fallback"""
        try:
            doc = fitz.open(file_path)
            results = []
            for i, page in enumerate(doc):
                text = page.get_text()
                # 간단한 정제 (너무 짧은 페이지 제외)
                if len(text.strip()) > 5:
                    results.append({"text": text, "page": i + 1})
            return results
        except Exception as e:
            logger.error(f"[PdfParser] Basic fitz extraction failed: {e}")
            return []

    def _parse_with_llamaparse(
        self, file_path: str, api_key: str, target_pages: str = None
    ) -> List[Dict[str, Any]]:
        """LlamaParse API를 사용하여 고품질 파싱 (OCR 수행)"""
        try:
            import nest_asyncio

            nest_asyncio.apply()
        except ImportError:
            pass

        try:
            from llama_parse import LlamaParse
        except ImportError:
            logger.error("[PdfParser] llama-parse not installed.")
            return []

        try:
            # fast_mode=True uses text extraction mostly, False uses OCR (required for scanned docs)
            # result_type="markdown" caused 'markdown' error in some versions, relying on default for now
            parser = LlamaParse(
                api_key=api_key,
                # result_type="markdown",
                language="ko",
                fast_mode=False,
                target_pages=target_pages,
                verbose=True,
            )

            # load_data returns List[Document]
            documents = parser.load_data(file_path)

            results = []
            for doc in documents:
                # LlamaParse Document has 'text' field (markdown) and metadata
                page_num = 1
                if "page_label" in doc.metadata:
                    try:
                        page_num = int(doc.metadata["page_label"])
                    except Exception:
                        pass

                results.append({"text": doc.text, "page": page_num})

            return results

        except Exception:
            logger.exception("LlamaParse failed")
            return self._parse_with_pymupdf(file_path)
