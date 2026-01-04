import json
import os
from typing import Any, Dict

from services.ingestion.parsers.docx_parser import DocxParser
from services.ingestion.parsers.excel_csv_parser import ExcelCsvParser
from services.ingestion.parsers.pdf_parser import PdfParser
from services.ingestion.parsers.txt_parser import TxtParser
from services.ingestion.processors.base import BaseProcessor, ProcessingResult


class FileProcessor(BaseProcessor):
    """
    [FileProcessor]
    로컬 파일 처리를 담당하는 프로세서입니다.
    파일 확장자에 따라 적절한 Parser를 선택하여 실행합니다.
    """

    def process(self, source_config: Dict[str, Any]) -> ProcessingResult:
        """
        source_config: {"file_path": "/path/to/file.pdf", "document_id": "...", "strategy": "llamaparse"}
        """
        file_path = source_config.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()
        parser = self._get_parser(ext)
        if not parser:
            print(f"[FileProcessor] Unsupported file extension: {ext}")
            return ProcessingResult(
                chunks=[], metadata={"error": "Unsupported extension"}
            )

        parse_kwargs = {}
        strategy = source_config.get("strategy", "general")

        if isinstance(parser, PdfParser) and strategy == "llamaparse":
            parse_kwargs["strategy"] = "llamaparse"
            parse_kwargs["api_key"] = self._get_llamaparse_key()

        try:
            parsed_blocks = parser.parse(file_path, **parse_kwargs)
        except Exception as e:
            print(f"[FileProcessor] Parsing error: {e}")
            return ProcessingResult(chunks=[], metadata={"error": str(e)})

        chunks = []
        for block in parsed_blocks:
            chunks.append(
                {
                    "content": block["text"],
                    "metadata": {"page": block["page"], "source": file_path},
                }
            )

        return ProcessingResult(
            chunks=chunks,
            metadata={"file_path": file_path, "extension": ext, "strategy": strategy},
        )

    def analyze(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        파일 분석 (비용 예측 등)
        """
        file_path = source_config.get("file_path")
        if not file_path or not os.path.exists(file_path):
            return {"error": "File not found"}

        ext = os.path.splitext(file_path)[1].lower()
        parser = self._get_parser(ext)

        # 현재는 PdfParser만 analyze 메서드를 가짐
        if parser and hasattr(parser, "analyze"):
            return parser.analyze(file_path)

        return {}

    def _get_parser(self, ext: str):
        if ext == ".pdf":
            return PdfParser()
        elif ext == ".docx":
            return DocxParser()
        elif ext in [".txt", ".md"]:
            return TxtParser()
        elif ext in [".csv", ".xlsx", ".xls"]:
            return ExcelCsvParser()
        return None

    def _get_llamaparse_key(self) -> str:
        """
        DB에서 LlamaParse API Key 조회
        """
        env_key = os.getenv("LLAMA_CLOUD_API_KEY")
        if env_key:
            return env_key

        if not self.db:
            return None

        from db.models.llm import LLMCredential, LLMProvider

        provider = (
            self.db.query(LLMProvider).filter(LLMProvider.name == "llamaparse").first()
        )
        if not provider:
            return None

        query = self.db.query(LLMCredential).filter(
            LLMCredential.provider_id == provider.id, LLMCredential.is_valid
        )
        if self.user_id:
            user_cred = (
                query.filter(LLMCredential.user_id == self.user_id)
                .order_by(LLMCredential.created_at.desc())
                .first()
            )
            if user_cred:
                return self._extract_key(user_cred)

        sys_cred = query.order_by(LLMCredential.created_at.desc()).first()
        if sys_cred:
            return self._extract_key(sys_cred)

        return None

    def _extract_key(self, cred) -> str:
        try:
            cfg = json.loads(cred.encrypted_config)
            return cfg.get("apiKey")
        except Exception:
            return None
