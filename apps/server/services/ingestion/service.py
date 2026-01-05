import hashlib
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, SourceType
from services.ingestion.factory import IngestionFactory


class IngestionOrchestrator:
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
        print(f"[DEBUG] DB session active: {self.db is not None}")
        doc = self.db.query(Document).get(document_id)
        if not doc:
            print(f"[DEBUG] Document {document_id} not found.")
            return

        print(f"[DEBUG] Document found - source_type: {doc.source_type}")
        print(f"[DEBUG] meta_info: {doc.meta_info}")

        # 초기 상태 저장 (업데이트 전)
        initial_status = doc.status

        try:
            self._update_status(document_id, "indexing")
            processor = IngestionFactory.get_processor(
                doc.source_type, self.db, self.user_id
            )
            print(f"[DEBUG] Processor created: {type(processor).__name__}")

            source_config = self._build_config(doc)
            print(f"[DEBUG] Built config: {source_config}")

            result = processor.process(source_config)
            print(
                f"[DEBUG] Processor result - chunks: {len(result.chunks)}, metadata: {result.metadata}"
            )

            if result.metadata.get("error"):
                raise Exception(result.metadata["error"])

            raw_blocks = result.chunks
            if not raw_blocks:
                print("No content extracted.")
                self._update_status(document_id, "completed")
                return

            full_text = "".join([b["content"] for b in raw_blocks])
            new_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
            # 실패했던 문서는 내용이 같아도 재처리 (status != 'failed' 조건 추가)
            # 임베딩 모델이 변경된 경우에도 재처리
            if (
                doc.content_hash == new_hash
                and doc.embedding_model == self.ai_model
                and initial_status != "failed"
            ):
                print("Content unchanged. Skipping.")
                self._update_status(document_id, "completed")
                return

            doc.content_hash = new_hash
            self.db.commit()

            final_chunks = self._refine_chunks(raw_blocks)
            self._save_to_vector_db(doc, final_chunks)
            print(
                f"[IngestionOrchestrator] Document processing completed successfully: {doc.filename} ({document_id})"
            )
            self._update_status(document_id, "completed")

        except Exception as e:
            print(f"[IngestionOrchestrator] Failed: {e}")
            self.db.rollback()
            self._update_status(document_id, "failed", str(e))

    def resume_processing(self, document_id: UUID, strategy: str):
        """
        사용자 승인 후 파싱 재개
        """
        doc = self.db.query(Document).get(document_id)
        if not doc:
            return

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

        processor = IngestionFactory.get_processor(source_type, self.db, self.user_id)

        source_config = {}
        if source_type == SourceType.FILE:
            source_config = {"file_path": file_path, "strategy": strategy}
        elif source_type == SourceType.API:
            api_config = meta_info.get("api_config", {})
            # api_config가 JSON string일 수 있으므로 파싱
            if isinstance(api_config, str):
                try:
                    import json

                    api_config = json.loads(api_config)
                except:
                    api_config = {}
            source_config = api_config
        elif source_type == SourceType.DB:
            base_config = meta_info or {}
            # db_config가 JSON string일 수 있으므로 파싱
            if isinstance(db_config, str):
                try:
                    import json

                    db_config = json.loads(db_config)
                except:
                    db_config = {}
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
        from services.llm_service import LLMService

        self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == doc.id
        ).delete()
        new_chunks = []
        print(f"[DEBUG] 시작 : _save_to_vector_db, 청크수: {len(chunks)} chunks")

        # LLM 클라이언트 초기화 (임베딩 생성용)
        llm_client = None
        if self.user_id:
            try:
                llm_client = LLMService.get_client_for_user(
                    db=self.db,
                    user_id=self.user_id,
                    model_id=self.ai_model,  # 예: "text-embedding-3-small"
                )
                print("[DEBUG] 임베딩 모델이 입력된 llm_client 생성 완료")
            except Exception as e:
                print(f"[ERROR] Failed to get LLM client: {e}")
                print("[WARNING] Falling back to dummy vectors")
        else:
            print("[WARNING] No user_id provided.")

        for i, chunk in enumerate(chunks):
            if (i + 1) % 5 == 0:
                print(f"[DEBUG] {i + 1}/{len(chunks)} 개의 청크 처리 중...")
            # 실제 임베딩 생성
            if llm_client:
                try:
                    embedding = llm_client.embed(chunk["content"])
                except Exception as e:
                    print(f"[ERROR] Embedding failed for chunk {i}: {e}")
                    raise Exception(f"OpenAI Embedding Error: {str(e)}")
                # print(f"[DEBUG] Embedding generated for chunk {i + 1}")
            else:
                embedding = [0.1] * 1536  # Fallback

            new_chunk = DocumentChunk(
                document_id=doc.id,
                knowledge_base_id=doc.knowledge_base_id,
                content=chunk["content"],
                chunk_index=i,
                token_count=chunk.get("token_count", 0),
                metadata_=chunk["metadata"],
                embedding=embedding,
            )
            new_chunks.append(new_chunk)

            # Progress polling을 위해 청크를 20%씩 처리
            update_interval = max(1, int(len(chunks) * 0.1))
            if (i + 1) % update_interval == 0 or (i + 1) == len(chunks):
                progress = ((i + 1) / len(chunks)) * 100
                # 메타데이터 업데이트 (DB commit 포함)
                new_meta = dict(doc.meta_info or {})
                new_meta["processing_progress"] = progress
                doc.meta_info = new_meta
                self.db.add(doc)  # Ensure doc is attached
                self.db.commit()
                print(f"[DEBUG] Progress updated: {progress:.1f}%")
        self.db.bulk_save_objects(new_chunks)

        # 임베딩 생성 시 사용한 모델명 저장
        doc.embedding_model = self.ai_model
        self.db.add(doc)

        self.db.commit()
        print(f"Saved {len(new_chunks)} chunks to Vector DB.")

    def _update_status(self, document_id: UUID, status: str, error_message: str = None):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            doc.error_message = error_message
            doc.updated_at = datetime.now(timezone.utc)
            self.db.commit()

    def reindex_knowledge_base(self, kb_id: UUID, new_model: str):
        print(
            f"[IngestionOrchestrator] re-indexing 시작.. KB {kb_id} with model {new_model}"
        )

        # 임베딩 모델 업데이트
        self.ai_model = new_model

        # 해당 KB의 모든 문서 조회
        documents = (
            self.db.query(Document).filter(Document.knowledge_base_id == kb_id).all()
        )

        if not documents:
            print(f"[IngestionOrchestrator] No documents found for KB {kb_id}")
            return

        print(f"[IngestionOrchestrator] Found {len(documents)} documents to re-index")

        for doc in documents:
            try:
                # 상태를 pending으로 변경하여 UI에 재처리 중임을 표시
                self._update_status(doc.id, "pending")
                self.process_document(doc.id)
            except Exception as e:
                print(
                    f"[IngestionOrchestrator] Error re-indexing document {doc.id}: {str(e)}"
                )
                # 개별 실패 시 로그 남기고 계속 진행
                self._update_status(doc.id, "failed", error_message=str(e))
