from enum import Enum
from typing import Any, Dict, List

import fitz  # PyMuPDF
import pymupdf4llm

from apps.gateway.services.ingestion.parsers.base import BaseParser


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
            print(f"[PdfParser] PyMuPDF extracted {len(md_text_chunks)} chunks")

            # [NEW] Check for empty content (pymupdf4llm failure)
            # 구분선(-----)만 있고 실제 텍스트가 없는 경우 감지
            total_content_len = 0
            for chunk in md_text_chunks:
                clean_text = chunk["text"].replace("-", "").strip()
                total_content_len += len(clean_text)

            if total_content_len < 20:  # 텍스트가 거의 없다고 판단
                print(
                    "[PdfParser] pymupdf4llm extracted little to no text. Falling back to standard fitz extraction."
                )
                return self._parse_with_fitz_fallback(file_path)

            results = []
            for chunk in md_text_chunks:
                text_content = chunk["text"]
                print(
                    f"[PdfParser] Page {chunk['metadata']['page'] + 1} content sample: {text_content[:50]}..."
                )
                results.append(
                    {"text": text_content, "page": chunk["metadata"]["page"] + 1}
                )
            return results
        except Exception as e:
            print(f"[PdfParser] PyMuPDF failed: {e}")
            print("[PdfParser] Trying fallback to standard fitz extraction...")
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
            print(f"[PdfParser] Fallback extraction got {len(results)} pages with text")
            return results
        except Exception as e:
            print(f"[PdfParser] Basic fitz extraction failed: {e}")
            return []

    def _parse_with_llamaparse(
        self, file_path: str, api_key: str
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
            print("[PdfParser] llama-parse not installed.")
            return []

        print(f"[PdfParser] Running LlamaParse on {file_path}")
        try:
            # 이벤트 루프를 먼저 생성 (LlamaParse 객체 생성 시 필요)
            import asyncio

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # fast_mode=True uses text extraction mostly, False uses OCR (required for scanned docs)
                # result_type="markdown" caused 'markdown' error in some versions, relying on default for now
                parser = LlamaParse(
                    api_key=api_key,
                    # result_type="markdown",
                    language="ko",
                    fast_mode=False,
                    verbose=True,
                )

                # 비동기 메서드 실행
                documents = loop.run_until_complete(parser.aload_data(file_path))
                print(
                    f"[PdfParser] LlamaParse returned {len(documents)} document objects"
                )
            finally:
                loop.close()

            results = []
            for doc in documents:
                # LlamaParse Document has 'text' field (markdown) and metadata
                page_num = 1
                if "page_label" in doc.metadata:
                    try:
                        page_num = int(doc.metadata["page_label"])
                    except Exception:
                        pass

                print(
                    f"[PdfParser] LlamaParse Page {page_num} sample: {doc.text[:50]}..."
                )
                results.append({"text": doc.text, "page": page_num})

            return results

        except Exception as e:
            import traceback

            traceback.print_exc()
            print(f"[PdfParser] LlamaParse failed: {e}")
            # Fallback to PyMuPDF if strict mode not required, or just return empty
            print("[PdfParser] Falling back to PyMuPDF due to error")
            return self._parse_with_pymupdf(file_path)
