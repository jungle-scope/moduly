import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import tiktoken
from fastapi import UploadFile
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, SourceType
from services.ingestion.factory import IngestionFactory
from services.storage import get_storage_service  # [NEW]


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
        """
        StorageService를 사용하여 파일을 저장하고 경로를 반환합니다.
        (Local: 파일 경로, S3: s3://...)
        """
        storage = get_storage_service()
        return storage.upload(file)

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

    def _filter_chunks(
        self,
        chunks: List[Dict[str, Any]],
        selection_mode: str,
        chunk_range: Optional[str],
        keyword_filter: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        주어진 조건에 따라 청크 리스트를 필터링합니다.
        """
        if not chunks:
            return []

        # 1. 'all' 모드면 필터링 없음
        if selection_mode == "all" or not selection_mode:
            return chunks

        # 2. 'range' 모드
        if selection_mode == "range" and chunk_range:
            indices = set()
            try:
                parts = [p.strip() for p in chunk_range.split(",")]
                for part in parts:
                    if "-" in part:
                        start, end = map(int, part.split("-"))
                        indices.update(range(start, end + 1))
                    else:
                        indices.add(int(part))
            except Exception as e:
                print(f"[WARNING] Invalid chunk range format: {chunk_range} ({e})")
                return chunks  # 파싱 실패 시 전체 반환 (안전장치)

            # 인덱스는 1부터 시작한다고 가정 (UI와 통일)
            return [c for i, c in enumerate(chunks) if (i + 1) in indices]

        # 3. 'keyword' 모드
        if selection_mode == "keyword" and keyword_filter:
            keyword = keyword_filter.lower()
            return [c for c in chunks if keyword in c["content"].lower()]

        return chunks

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

            # [NEW] 필터링 적용
            meta = doc.meta_info or {}
            selection_mode = meta.get("selection_mode", "all")
            chunk_range = meta.get("chunk_range")
            keyword_filter = meta.get("keyword_filter")

            filtered_chunks = self._filter_chunks(
                final_chunks, selection_mode, chunk_range, keyword_filter
            )

            print(
                f"[DEBUG] Filtering: {len(final_chunks)} -> {len(filtered_chunks)} chunks (Mode: {selection_mode})"
            )

            self._save_to_vector_db(doc, filtered_chunks)
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

        pages = analysis_result.get("pages", 0)

        # Pricing Policy (LlamaCloud Standard Mode - fast_mode=False):
        # source: https://cloud.llamaindex.ai/pricing
        # Rate: $0.003 per page for Standard Parsing (OCR enabled)
        # Free Tier: First 1000 pages/day are free, but we calculate full potential cost here.

        target_price_per_page = 0.003
        credits_est = pages * 1  # 1 page = 1 credit unit
        cost_usd_est = pages * target_price_per_page

        cost_estimate = {
            "pages": pages,
            "credits": credits_est,
            "cost_usd": cost_usd_est,
        }

        return {
            "cost_estimate": cost_estimate,
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
        # 필터링 파라미터 추가
        selection_mode: str = "all",
        chunk_range: Optional[str] = None,
        keyword_filter: Optional[str] = None,
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

        # [NEW] 필터링 적용
        return self._filter_chunks(preview, selection_mode, chunk_range, keyword_filter)

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
        import re

        import tiktoken

        from services.llm_service import LLMService
        from utils.encryption import encryption_manager
        from utils.template_utils import count_tokens

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

        # ========================================
        # 토큰 기반 배치 구성
        # ========================================
        MAX_TOKENS_PER_TEXT = 8000  # 개별 텍스트 최대 (안전 마진 191)
        MAX_TEXTS_PER_BATCH = 100  # 배치당 최대 텍스트 개수

        batches = []
        current_batch = []

        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            tokens = count_tokens(content)

            # 개별 텍스트 토큰 체크
            if tokens > MAX_TOKENS_PER_TEXT:
                print(
                    f"[WARNING] Text too long ({tokens} tokens), truncating to {MAX_TOKENS_PER_TEXT}..."
                )
                # 토큰 수만큼 자르기
                try:
                    encoding = tiktoken.encoding_for_model(self.ai_model)
                    encoded = encoding.encode(content)
                    truncated = encoded[:MAX_TOKENS_PER_TEXT]
                    content = encoding.decode(truncated)
                    chunk["content"] = content
                except Exception as e:
                    print(f"[ERROR] Failed to truncate: {e}")

            # 배치 크기 체크
            if len(current_batch) >= MAX_TEXTS_PER_BATCH:
                batches.append(current_batch)
                current_batch = []

            current_batch.append((i, chunk))

        if current_batch:
            batches.append(current_batch)

        print(
            f"[INFO] Created {len(batches)} batches (max {MAX_TEXTS_PER_BATCH} texts/batch)"
        )

        # ========================================
        # 배치별 임베딩 생성
        # ========================================
        all_embeddings = {}  # {chunk_index: embedding}

        for batch_idx, batch in enumerate(batches):
            batch_texts = [chunk["content"] for _, chunk in batch]
            batch_indices = [idx for idx, _ in batch]

            print(
                f"[DEBUG] Processing batch {batch_idx + 1}/{len(batches)} ({len(batch_texts)} texts)..."
            )

            if llm_client:
                try:
                    # 배치 임베딩 호출
                    batch_embeddings = llm_client.embed_batch(batch_texts)

                    # 인덱스 매핑
                    for idx, embedding in zip(batch_indices, batch_embeddings):
                        all_embeddings[idx] = embedding

                except Exception as e:
                    print(f"[ERROR] Batch embedding failed for batch {batch_idx}: {e}")
                    # Fallback: 개별 임베딩
                    for idx, chunk in batch:
                        try:
                            embedding = llm_client.embed(chunk["content"])
                            all_embeddings[idx] = embedding
                        except Exception as e2:
                            print(
                                f"[ERROR] Individual embedding also failed for chunk {idx}: {e2}"
                            )
                            all_embeddings[idx] = [0.1] * 1536
            else:
                # LLM client 없으면 더미 벡터
                for idx, _ in batch:
                    all_embeddings[idx] = [0.1] * 1536

        # ========================================
        # content 암호화 & DB 저장
        # ========================================
        for i, chunk in enumerate(chunks):
            if (i + 1) % 50 == 0:
                print(f"[DEBUG] {i + 1}/{len(chunks)} 개의 청크 암호화 중...")

            content = chunk["content"]
            embedding = all_embeddings.get(i, [0.1] * 1536)

            # content에서 민감 컬럼만 암호화
            sensitive_columns = chunk.get("metadata", {}).get("sensitive_columns", [])
            if sensitive_columns:
                for col in sensitive_columns:
                    # "colname: value" 패턴 찾아서 암호화
                    pattern = rf"({re.escape(col)}:\s*)([^\n]+)"

                    def encrypt_match(match):
                        key = match.group(1)  # "email: "
                        value = match.group(2)  # "hong@example.com"
                        try:
                            encrypted_value = encryption_manager.encrypt(value)
                            return f"{key}{encrypted_value}"
                        except Exception as e:
                            print(f"[ERROR] Failed to encrypt {col}: {e}")
                            return match.group(0)  # 암호화 실패 시 원본 유지

                    content = re.sub(pattern, encrypt_match, content)

            new_chunk = DocumentChunk(
                document_id=doc.id,
                knowledge_base_id=doc.knowledge_base_id,
                content=content,
                chunk_index=i,
                token_count=chunk.get("token_count", 0),
                metadata_=chunk["metadata"],
                embedding=embedding,
            )
            new_chunks.append(new_chunk)

            # Progress polling을 위해 청크를 10%씩 처리
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
