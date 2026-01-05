from enum import Enum
from typing import Any, Dict, List

import fitz  # PyMuPDF
import pymupdf4llm

from services.ingestion.parsers.base import BaseParser


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

        Returns:
            [{"text": "...", "page": 1}, ...]
        """
        strategy = kwargs.get("strategy", "general")

        if strategy == "llamaparse":
            api_key = kwargs.get("api_key")
            if not api_key:
                raise ValueError("LlamaParse strategy requires 'api_key'")
            return self._parse_with_llamaparse(source_path, api_key)
        else:
            return self._parse_with_pymupdf(source_path)

    def analyze(self, file_path: str) -> Dict[str, Any]:
        """
        PDF 파일의 성격을 분석하여 적절한 처리 전략을 제안합니다.
        (기존 _analyze_pdf_type 로직 이식)
        """
        doc = fitz.open(file_path)
        total_pages = len(doc)

        # 샘플링 (앞3, 중간1, 뒤2)
        sample_indices = set()
        for i in range(min(3, total_pages)):
            sample_indices.add(i)
        if total_pages > 3:
            sample_indices.add(total_pages // 2)
        if total_pages > 1:
            sample_indices.add(total_pages - 1)
        if total_pages > 2:
            sample_indices.add(total_pages - 2)

        text_length = 0
        image_count = 0
        page_count = 0

        for idx in sample_indices:
            if idx >= total_pages:
                continue
            page = doc[idx]
            page_count += 1
            text_length += len(page.get_text().strip())
            image_count += len(page.get_images(full=True))

        doc.close()

        avg_text = text_length / page_count if page_count > 0 else 0
        avg_imgs = image_count / page_count if page_count > 0 else 0

        strategy = "general"
        if avg_text < 50:
            strategy = "llamaparse"  # OCR 필요
        elif avg_imgs > 2:
            strategy = "llamaparse"  # 혼합된 Layout

        return {
            "strategy": strategy,
            "stats": {"avg_text": avg_text, "avg_imgs": avg_imgs},
            "pages": total_pages,
        }

    def _parse_with_pymupdf(self, file_path: str) -> List[Dict[str, Any]]:
        """PyMuPDF4LLM을 사용하여 빠르게 마크다운 텍스트 추출"""
        try:
            md_text_chunks = pymupdf4llm.to_markdown(file_path, page_chunks=True)
            results = []
            for chunk in md_text_chunks:
                results.append(
                    {"text": chunk["text"], "page": chunk["metadata"]["page"] + 1}
                )
            return results
        except Exception as e:
            print(f"[PdfParser] PyMuPDF failed: {e}")
            return []

    def _parse_with_llamaparse(
        self, file_path: str, api_key: str
    ) -> List[Dict[str, Any]]:
        """LlamaParse API를 사용하여 고품질 파싱 (OCR 수행)"""
        try:
            from llama_parse import LlamaParse
        except ImportError:
            print("[PdfParser] llama-parse not installed.")
            return []

        print(f"[PdfParser] Running LlamaParse on {file_path}")
        parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            language="ko",
            fast_mode=True,
            verbose=True,
        )

        json_results = parser.get_json_result(file_path)

        results = []
        if json_results and isinstance(json_results, list):
            pages = json_results[0].get("pages", [])
            for p in pages:
                md_text = p.get("md") or p.get("text") or ""
                results.append({"text": md_text, "page": p["page"]})
        return results
