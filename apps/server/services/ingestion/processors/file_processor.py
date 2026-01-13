import json
import os
import tempfile
from typing import Any, Dict

import requests

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
        if not file_path:
            raise FileNotFoundError("File path is missing")

        # [MODIFIED] S3/HTTP URL 처리
        is_remote_file = str(file_path).startswith("http") or str(file_path).startswith(
            "s3://"
        )
        temp_file_path = None

        try:
            if is_remote_file:
                # 임시 파일 다운로드
                temp_file_path = self._download_file(file_path)
                target_path = temp_file_path
            else:
                # 로컬 파일
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"File not found: {file_path}")
                target_path = file_path

            ext = os.path.splitext(target_path)[1].lower()
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
                parsed_blocks = parser.parse(target_path, **parse_kwargs)
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
                metadata={
                    "file_path": file_path,
                    "extension": ext,
                    "strategy": strategy,
                },
            )

        finally:
            # 임시 파일 정리
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"[Warning] Failed to remove temp file: {e}")

    def _download_file(self, url: str) -> str:
        """
        URL(S3 포함)에서 파일을 다운로드하여 임시 경로를 반환합니다.
        """
        # s3:// 포맷이 그대로 넘어온 경우 처리 (storage service를 안 거친 경우 등)
        if url.startswith("s3://"):
            # 여기서는 단순히 에러 처리하거나, 혹은 Presigned URL 발급 로직이 필요함.
            # 현재는 knowledge.py의 리다이렉트 로직과 맞추어 HTTP URL을 기대함.
            raise ValueError(
                "Raw s3:// URL is not supported for direct processing. Use HTTP URL."
            )

        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()

            # 확장자 추론
            from urllib.parse import urlparse

            path = urlparse(url).path
            ext = os.path.splitext(path)[1]
            if not ext:
                ext = ".tmp"

            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp.write(chunk)
                return tmp.name
        except Exception as e:
            raise RuntimeError(f"Failed to download file from {url}: {e}")

    def analyze(self, source_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        파일 분석 (비용 예측 등)
        """
        file_path = source_config.get("file_path")
        if not file_path:
            return {"error": "File path is missing"}

        is_remote_file = str(file_path).startswith("http") or str(file_path).startswith(
            "s3://"
        )
        temp_file_path = None

        try:
            if is_remote_file:
                temp_file_path = self._download_file(file_path)
                target_path = temp_file_path
            else:
                if not os.path.exists(file_path):
                    return {"error": "File not found"}
                target_path = file_path

            ext = os.path.splitext(target_path)[1].lower()
            parser = self._get_parser(ext)

            # 현재는 PdfParser만 analyze 메서드를 가짐
            if parser and hasattr(parser, "analyze"):
                return parser.analyze(target_path)

            return {}

        except Exception as e:
            return {"error": str(e)}

        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as e:
                    print(f"[Warning] Failed to remove temp file: {e}")

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

        from apps.shared.db.models.llm import LLMCredential, LLMProvider

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
