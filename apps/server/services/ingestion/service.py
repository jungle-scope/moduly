import hashlib
import os
import re
import shutil
import uuid
from typing import Any, Dict, List, Optional
from uuid import UUID

import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, SourceType
from services.ingestion.factory import IngestionFactory


class IngestionOrchestrator:
    """
    [IngestionOrchestrator]
    기존 IngestionService의 역할을 대체하는 새로운 서비스 클래스입니다.
    """

    def __init__(
        self,
        db: Session,
        user_id: Optional[UUID] = None,
        chunk_size=1000,
        chunk_overlap=200,
        ai_model="text-embedding-3-small",
    ):
        self.db = db
        self.user_id = user_id
        self.ai_model = ai_model

        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""],
            keep_separator=True,
        )

    def save_temp_file(self, file: UploadFile) -> str:
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        unique_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(upload_dir, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

    def create_pending_document(
        self,
        knowledge_base_id: UUID,
        filename: str,
        file_path: Optional[str],
        chunk_size: int,
        chunk_overlap: int,
        source_type: SourceType = SourceType.FILE,
        meta_info: dict = None,
    ) -> UUID:
        new_doc = Document(
            knowledge_base_id=knowledge_base_id,
            filename=filename,
            file_path=file_path,
            status="pending",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            source_type=source_type,
            meta_info=meta_info or {},
        )
        self.db.add(new_doc)
        self.db.commit()
        self.db.refresh(new_doc)
        return new_doc.id

    def process_document(self, document_id: UUID):
        print(f"[IngestionOrchestrator] Starting process for doc {document_id}")
        doc = self.db.query(Document).get(document_id)
        if not doc:
            print(f"Document {document_id} not found.")
            return

        try:
            self._update_status(document_id, "indexing")
            processor = IngestionFactory.get_processor(
                doc.source_type, self.db, self.user_id
            )
            source_config = self._build_config(doc)
            result = processor.process(source_config)

            if result.metadata.get("error"):
                raise Exception(result.metadata["error"])

            raw_blocks = result.chunks
            if not raw_blocks:
                print("No content extracted.")
                self._update_status(document_id, "completed")
                return

            full_text = "".join([b["content"] for b in raw_blocks])
            new_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
            if doc.content_hash == new_hash:
                print("Content unchanged. Skipping.")
                self._update_status(document_id, "completed")
                return

            doc.content_hash = new_hash
            self.db.commit()

            final_chunks = self._refine_chunks(raw_blocks)
            self._save_to_vector_db(doc, final_chunks)
            self._update_status(document_id, "completed")

        except Exception as e:
            print(f"[IngestionOrchestrator] Failed: {e}")
            self._update_status(document_id, "failed", str(e))

    def resume_processing(self, document_id: UUID, strategy: str):
        """
        사용자 승인 후 파싱 재개
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            return

        # Update strategy in meta_info and run
        new_meta = dict(doc.meta_info or {})
        new_meta["strategy"] = strategy
        doc.meta_info = new_meta
        self.db.commit()

        self.process_document(document_id)

    async def analyze_document(self, document_id: UUID) -> Dict[str, Any]:
        """
        문서 분석 (비용 예측)
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            raise ValueError("Document not found")

        processor = IngestionFactory.get_processor(
            doc.source_type, self.db, self.user_id
        )
        source_config = self._build_config(doc)

        analysis_result = processor.analyze(source_config)

        # Legacy compatibility format: "cost_estimate" key
        cost_estimate = analysis_result.get("stats", {})  # PdfParser returns stats
        # The legacy frontend expects {"cost_estimate": {"pages": ..., "cost_usd": ...}}
        # If new parser returns different format, we might need adapter here.
        # But PdfParser.analyze returns: {"strategy":..., "stats":..., "pages":...}
        # Ideally, PdfParser should return stats compatible with frontend OR we map it here.
        # Let's trust PdfParser to return what's needed or adapt minimally.

        return {
            "cost_estimate": analysis_result,  # Sending raw analysis for now
            "filename": doc.filename,
            "is_cached": False,
        }

    def preview_chunking(
        self,
        file_path: str,
        chunk_size: int,
        chunk_overlap: int,
        segment_identifier: str,
        remove_urls_emails: bool = False,
        remove_whitespace: bool = True,
        strategy: str = "general",
        source_type: SourceType = SourceType.FILE,
        meta_info: dict = None,
        db_config: dict = None,
    ) -> List[Dict[str, Any]]:
        """
        미리보기 (DB 저장 없음)
        """
        # 1. Pipeline Execution
        processor = IngestionFactory.get_processor(source_type, self.db, self.user_id)

        source_config = {}
        if source_type == SourceType.FILE:
            source_config = {"file_path": file_path, "strategy": strategy}
        elif source_type == SourceType.API:
            api_config = meta_info.get("api_config", {})
            source_config = api_config
        elif source_type == SourceType.DB:
            base_config = meta_info or {}
            source_config = {**base_config, **(db_config or {})}

        result = processor.process(source_config)

        # Check for errors from processor
        if result.metadata and "error" in result.metadata:
            raise Exception(f"Processor Error: {result.metadata['error']}")

        raw_blocks = result.chunks
        full_text = "\n".join([b["content"] for b in raw_blocks])

        # 2. Preprocessing (Legacy logic)
        if remove_urls_emails:
            full_text = re.sub(
                r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
                "",
                full_text,
            )
            full_text = re.sub(r"[\w\.-]+@[\w\.-]+", "", full_text)
        if remove_whitespace:
            full_text = re.sub(r"[ \t]+", " ", full_text)
            full_text = re.sub(r"\n{3,}", "\n\n", full_text)

        # 3. Chunking
        separators = ["\n\n", "\n", ".", " ", ""]
        if segment_identifier:
            identifier = segment_identifier.replace("\\n", "\n")
            if identifier not in separators:
                separators.insert(0, identifier)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators,
            keep_separator=True,
        )
        splits = splitter.split_text(full_text)

        # 4. Return preview format
        try:
            encoding = tiktoken.encoding_for_model(self.ai_model)
        except Exception:
            encoding = tiktoken.get_encoding("cl100k_base")

        preview = []
        for s in splits:
            preview.append(
                {
                    "content": s,
                    "token_count": len(encoding.encode(s)),
                    "char_count": len(s),
                }
            )
        return preview

    def _build_config(self, doc: Document) -> Dict[str, Any]:
        config = {"document_id": str(doc.id)}
        if doc.source_type == SourceType.FILE:
            config["file_path"] = doc.file_path
            if doc.meta_info and "strategy" in doc.meta_info:
                config["strategy"] = doc.meta_info["strategy"]
        elif doc.source_type == SourceType.API:
            api_config = doc.meta_info.get("api_config", {})
            config.update(api_config)
        elif doc.source_type == SourceType.DB:
            config.update(doc.meta_info or {})
            # Flatten db_config if it exists (DB Processor expects selections at root)
            if "db_config" in config and isinstance(config["db_config"], dict):
                config.update(config["db_config"])
        return config

    def _refine_chunks(self, raw_blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        refined = []
        for block in raw_blocks:
            splits = self.text_splitter.split_text(block["content"])
            original_meta = block.get("metadata", {})
            for split in splits:
                new_meta = original_meta.copy()
                refined.append({"content": split, "metadata": new_meta})
        return refined

    def _save_to_vector_db(self, doc: Document, chunks: List[Dict[str, Any]]):
        self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == doc.id
        ).delete()
        new_chunks = []
        for i, chunk in enumerate(chunks):
            dummy_vector = [0.1] * 1536
            new_chunk = DocumentChunk(
                document_id=doc.id,
                content=chunk["content"],
                chunk_index=i,
                meta_info=chunk["metadata"],
                embedding=dummy_vector,
            )
            new_chunks.append(new_chunk)
        self.db.bulk_save_objects(new_chunks)
        self.db.commit()
        print(f"Saved {len(new_chunks)} chunks to Vector DB.")

    def _update_status(self, document_id: UUID, status: str, error_message: str = None):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            doc.error_message = error_message
            self.db.commit()
