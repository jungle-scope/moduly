import hashlib
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import tiktoken
from fastapi import UploadFile
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from apps.gateway.services.ingestion.factory import IngestionFactory
from apps.gateway.services.storage import get_storage_service
from apps.shared.db.models.knowledge import (
    Document,
    DocumentChunk,
    ParsingRegistry,
    SourceType,
)
from apps.shared.db.session import SessionLocal
from apps.shared.distributed_lock import DistributedLock

logger = logging.getLogger(__name__)


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

    def _resolve_parsing_workflow(
        self,
        file_path: str,
        strategy: str = "llamaparse",
        meta_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        1. 파일 해시 계산 (SHA-256).
        2. ParsingRegistry 테이블에서 데이터 조회 (Cache Check).
        3. Cache Hit -> 스토리지에서 콘텐츠 로드.
        4. Cache Miss -> 전체 파싱 수행 -> 스토리지 저장 -> 레지스트리 등록.

        Args:
            file_path: 원본 파일 경로 (로컬).
            strategy: 파싱 전략 이름.
            meta_info: 추가 메타데이터.

        Returns:
            Dict containing:
            - content: 전체 마크다운 콘텐츠
            - is_cached: 캐시 적중 여부
            - pages: 페이지 수 (가능한 경우)
            - content_digest: SHA-256 해시
        """
        import hashlib

        # 1. SHA-256 다이제스트 계산
        logger.info(f"[_resolve_parsing_workflow] Start. Path: {file_path}")
        start_time = datetime.now()

        sha256 = hashlib.sha256()

        if file_path.startswith("http://") or file_path.startswith("https://"):
            import requests

            with requests.get(file_path, stream=True) as r:
                r.raise_for_status()
                for chunk in r.iter_content(chunk_size=8192):
                    sha256.update(chunk)
        else:
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    sha256.update(chunk)
        content_digest = sha256.hexdigest()
        logger.debug(f"[_resolve_parsing_workflow] File Hash: {content_digest}")

        # 2. 레지스트리 조회 (Cache Hit 확인)
        cached_registry = (
            self.db.query(ParsingRegistry)
            .filter(
                ParsingRegistry.content_digest == content_digest,
                ParsingRegistry.provider == strategy,  # 엔진 종류도 일치해야 함
            )
            .first()
        )

        if cached_registry:
            logger.info(f"[Cache Hit] Digest: {content_digest}")
            storage = get_storage_service()
            try:
                markdown_content = storage.retrieve_content(cached_registry.storage_key)
                duration = (datetime.now() - start_time).total_seconds()
                logger.info(
                    f"[_resolve_parsing_workflow] Completed (Cache Hit). Duration: {duration:.2f}s"
                )
                return {
                    "content": markdown_content,
                    "is_cached": True,
                    "pages": cached_registry.page_count,
                    "content_digest": content_digest,
                }
            except Exception as e:
                logger.error(f"[Cache Error] Failed to retrieve content: {e}")
                # 스토리지 파일이 유실되었으므로, 잘못된 레지스트리 항목 삭제 (Self-Healing)
                logger.warning(
                    f"[Cache Cleanup] Removing stale registry entry for digest: {content_digest}"
                )
                try:
                    self.db.delete(cached_registry)
                    self.db.commit()
                except Exception as db_e:
                    logger.error(
                        f"[Cache Cleanup Error] Failed to delete registry: {db_e}"
                    )
                    self.db.rollback()

        # 3. Cache Miss - 전체 파싱(Full Parsing) 시작
        logger.info(f"[Cache Miss] Starting Full Parsing. Digest: {content_digest}")

        # IngestionFactory를 통해 프로세서 획득
        # (주의: user_id가 필요하지만, Orchestrator는 self.user_id를 가짐)
        processor = IngestionFactory.get_processor(
            SourceType.FILE, self.db, self.user_id
        )

        # 파싱 설정 (전체 파싱)
        config = {
            "file_path": file_path,
            "strategy": strategy,
            **(meta_info or {}),
        }
        logger.info(f"[Cache Miss] Config prepared: {config}")

        result = processor.process(config)

        if result.metadata.get("error"):
            raise Exception(result.metadata["error"])

        # 청크 병합 -> 전체 마크다운 생성
        full_markdown = "\n\n".join([b["content"] for b in result.chunks])

        # 2. LlamaParse v1 메타데이터 기반 페이지 수 추출
        page_count = result.metadata.get("pages")

        # 만약 metadata에 없다면, 결과 조각(chunks) 중 첫 번째 요소의 메타데이터를 확인하거나 0으로 설정
        if page_count is None:
            # Fallback: 개별 청크의 메타데이터 확인 또는 청킹된 리스트의 특성 활용
            page_count = result.metadata.get("page_count", 0)

        # 4. 저장 및 등록 (Persist & Register)
        storage = get_storage_service()
        storage_key = storage.persist_content(full_markdown, "md")

        new_registry = ParsingRegistry(
            content_digest=content_digest,
            storage_key=storage_key,
            provider=strategy,
            page_count=page_count,
            meta_info=meta_info or {},
        )
        self.db.add(new_registry)
        try:
            self.db.commit()
            logger.info(f"[Cache Created] Digest: {content_digest}, Key: {storage_key}")
        except Exception as e:
            # Race Condition: 동시에 다른 요청이 먼저 저장했을 수 있음
            logger.warning(
                f"[Cache Register Warning] Failed to commit registry (Duplicate?): {e}"
            )
            self.db.rollback()
            # 이미 저장된 것으로 간주하고 진행 (필요하다면 다시 조회해서 검증 가능)

        duration = (datetime.now() - start_time).total_seconds()
        logger.info(
            f"[_resolve_parsing_workflow] Completed (Full Parse). Duration: {duration:.2f}s"
        )

        return {
            "content": full_markdown,
            "is_cached": False,
            "pages": page_count,
            "content_digest": content_digest,
        }

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
                logger.error(f"Invalid chunk range format: {chunk_range} ({e})")
                raise ValueError(f"잘못된 청크 범위 형식입니다: {chunk_range}") from e

            # 인덱스는 1부터 시작한다고 가정 (UI와 통일)
            return [c for i, c in enumerate(chunks) if (i + 1) in indices]

        # 3. 'keyword' 모드
        if selection_mode == "keyword" and keyword_filter:
            keyword = keyword_filter.lower()
            return [c for c in chunks if keyword in c["content"].lower()]

        return chunks

    def process_document(self, document_id: UUID):
        # 락 획득 시도 (2분 TTL)
        lock = DistributedLock(f"doc_processing:{document_id}", ttl=120)

        with lock.lock() as acquired:
            if not acquired:
                logger.error(
                    f"[IngestionOrchestrator] Document {document_id} is already being processed by another worker"
                )
                return

            session = SessionLocal()
            self.db = session

            try:
                doc = self.db.query(Document).get(document_id)
                if not doc:
                    logger.warning(f"Document {document_id} not found")
                    return

                # 초기 상태 저장 (업데이트 전)
                initial_status = doc.status

                # 이미 처리 완료된 문서 건너뛰기
                if doc.status == "completed":
                    return

                self._update_progress_redis(document_id, 0)
                self._update_status(document_id, "indexing")

                if doc.source_type == SourceType.FILE:
                    # FILE 타입만 캐싱 워크플로우 적용
                    parsing_result = self._resolve_parsing_workflow(
                        doc.file_path,
                        doc.meta_info.get("strategy", "llamaparse"),
                        doc.meta_info,
                    )
                    full_text = parsing_result["content"]

                    # Document 해시 업데이트 (변경된 경우)
                    new_hash = parsing_result["content_digest"]
                    # 실패했던 문서는 내용이 같아도 재처리 (status != 'failed' 조건 추가)
                    # 임베딩 모델이 변경된 경우에도 재처리
                    if (
                        doc.content_hash == new_hash
                        and doc.embedding_model == self.ai_model
                        and initial_status != "failed"
                    ):
                        self._update_status(document_id, "completed")
                        return

                    doc.content_hash = new_hash
                    self.db.commit()

                    # 로컬 메모리 상에서 전처리 및 청킹 수행
                    preprocessed_text = self.preprocess_text(
                        full_text, doc.meta_info or {}
                    )

                    # [동적 Splitter 생성] 문서 설정 적용
                    chunk_size = doc.chunk_size
                    chunk_overlap = doc.chunk_overlap
                    meta = doc.meta_info or {}
                    segment_identifier = meta.get("segment_identifier", "\\n\\n")

                    separators = ["\n\n", "\n", ".", " ", ""]
                    if segment_identifier:
                        identifier = segment_identifier.replace("\\n", "\n")
                        if identifier not in separators:
                            separators.insert(0, identifier)

                    doc_specific_splitter = RecursiveCharacterTextSplitter(
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                        separators=separators,
                        keep_separator=True,
                    )

                    # 메모리 상의 텍스트를 바로 청킹
                    final_chunks = []
                    splits = doc_specific_splitter.split_text(preprocessed_text)
                    for split in splits:
                        final_chunks.append({"content": split, "metadata": {}})

                elif doc.source_type == "DB":
                    # DB Processor 사용
                    processor = IngestionFactory.get_processor(
                        doc.source_type, self.db, self.user_id
                    )
                    source_config = self._build_config(doc)
                    result = processor.process(source_config)

                    if result.metadata.get("error"):
                        raise Exception(result.metadata["error"])
                    raw_blocks = result.chunks

                    if not raw_blocks:
                        logger.warning(
                            f"[IngestionOrchestrator] Document {document_id} (DB) raw_blocks is empty."
                        )
                        self._update_status(
                            document_id,
                            "completed",
                            error_message="추출 가능한 콘텐츠가 없습니다.",
                        )
                        return

                    final_chunks = self._refine_chunks(
                        raw_blocks, override_chunk_size=8000
                    )

                    # DB 데이터도 해시 비교를 위해 full_text 생성
                    full_text = "".join([b["content"] for b in raw_blocks])
                    new_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()
                    # 실패했던 문서는 내용이 같아도 재처리 (status != 'failed' 조건 추가)
                    # 임베딩 모델이 변경된 경우에도 재처리
                    if (
                        doc.content_hash == new_hash
                        and doc.embedding_model == self.ai_model
                        and initial_status != "failed"
                    ):
                        self._update_status(document_id, "completed")
                        return

                    doc.content_hash = new_hash
                    self.db.commit()

                # 필터링 적용
                meta = doc.meta_info or {}
                selection_mode = meta.get("selection_mode", "all")
                chunk_range = meta.get("chunk_range")
                keyword_filter = meta.get("keyword_filter")

                filtered_chunks = self._filter_chunks(
                    final_chunks, selection_mode, chunk_range, keyword_filter
                )

                self._save_to_vector_db(doc, filtered_chunks)
                self._update_status(document_id, "completed")
                self._update_progress_redis(
                    document_id, 100, expire=True
                )  # 완료 시 키 만료 또는 100 유지 후 만료
                logger.info(
                    f"[DEBUG] process_document 완료 - document_id: {document_id}"
                )

            except Exception as e:
                logger.error(
                    f"Document processing failed - ID: {document_id}, Reason: {e}"
                )
                self.db.rollback()
                self._update_status(document_id, "failed", str(e))
                self._update_progress_redis(
                    document_id, 0, expire=True
                )  # 실패 시 진행률 키 즉시 만료

            finally:
                if session:
                    session.close()

    def _update_progress_redis(
        self, document_id: UUID, progress: int, expire: bool = False
    ):
        """
        진행률을 Redis에 저장 (DB 과부하 방지)
        이전 값보다 작으면 업데이트하지 않음
        expire=True: 완료/실패 시 100을 저장하고 짧은 TTL로 자동 만료
        """
        from apps.shared.pubsub import get_redis_client

        try:
            redis_client = get_redis_client()
            key = f"knowledge_progress:{document_id}"

            if expire:
                # 완료/실패 시 100을 저장하고 30초 후 자동 삭제
                redis_client.set(key, str(progress), ex=30)
                return

            current_val = redis_client.get(key)
            if current_val:
                try:
                    current_progress = int(current_val)
                    if progress < current_progress:
                        return
                except ValueError:
                    pass

            # 진행률 저장
            redis_client.set(key, str(progress), ex=600)
        except Exception as e:
            logger.warning(f"Failed to update progress in Redis: {e}")

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

    async def analyze_document(
        self, document_id: UUID, strategy: str = "llamaparse"
    ) -> Dict[str, Any]:
        """
        문서 분석 (비용 예측)
        - 글로벌 파싱 캐시(ParsingRegistry)에 해당 파일이 이미 있으면 is_cached=True 반환
        - strategy: UI에서 선택한 파싱 전략
        """
        import hashlib

        doc = self.db.query(Document).get(document_id)
        if not doc:
            raise ValueError("Document not found")

        # 1. 파일 해시 계산 (캐시 조회용)
        content_digest = None
        if doc.file_path:
            try:
                sha256 = hashlib.sha256()
                if doc.file_path.startswith("http://") or doc.file_path.startswith(
                    "https://"
                ):
                    import requests

                    with requests.get(doc.file_path, stream=True) as r:
                        r.raise_for_status()
                        for chunk in r.iter_content(chunk_size=8192):
                            sha256.update(chunk)
                else:
                    with open(doc.file_path, "rb") as f:
                        for chunk in iter(lambda: f.read(4096), b""):
                            sha256.update(chunk)
                content_digest = sha256.hexdigest()
            except Exception as e:
                logger.warning(f"[analyze_document] Failed to calculate hash: {e}")

        # 2. 캐시 조회 (UI에서 선택한 strategy로 조회)
        if content_digest:
            cached_registry = (
                self.db.query(ParsingRegistry)
                .filter(
                    ParsingRegistry.content_digest == content_digest,
                    ParsingRegistry.provider == strategy,
                )
                .first()
            )
            if cached_registry:
                logger.info(
                    f"[analyze_document] Cache hit for digest: {content_digest}"
                )
                return {
                    "cost_estimate": {
                        "pages": cached_registry.page_count,
                        "credits": 0,  # 캐시 사용 시 비용 없음
                        "cost_usd": 0.0,
                    },
                    "filename": doc.filename,
                    "is_cached": True,
                }

        # 3. Cache Miss - 기존 비용 예측 로직 실행
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
            # 캐싱 워크플로우 사용 (Full Parse & Cache if miss)
            # 캐시가 없으면 전체 파싱 후 저장, 있으면 로드하여 사용
            parsing_result = self._resolve_parsing_workflow(
                file_path, strategy, meta_info
            )
            full_text = parsing_result["content"]

            # 2. 전처리 (메모리 상의 full_text 사용)
            options = {
                "remove_urls_emails": remove_urls_emails,
                "normalize_whitespace": remove_whitespace,
            }
            full_text = self.preprocess_text(full_text, options)

            # 3. 청킹
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

            # 4. 미리보기 형식 반환
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

            return self._filter_chunks(
                preview, selection_mode, chunk_range, keyword_filter
            )

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
            raise ValueError(result.metadata["error"])

        raw_blocks = result.chunks

        # DB인 경우 이미 Row 단위로 구조화되어 있으므로, Merge & Re-split 하지 않음
        if source_type == SourceType.DB:
            # 8000자 초과 시에만 분할
            final_splits = self._refine_chunks(raw_blocks, override_chunk_size=8000)

            # Tiktoken 인코더 준비
            try:
                encoding = tiktoken.encoding_for_model(self.ai_model)
            except Exception:
                encoding = tiktoken.get_encoding("cl100k_base")

            preview = []
            for block in final_splits:
                content = block["content"]
                preview.append(
                    {
                        "content": content,
                        "token_count": len(encoding.encode(content)),
                        "char_count": len(content),
                    }
                )

            # 필터링 적용 후 반환
            return self._filter_chunks(
                preview, selection_mode, chunk_range, keyword_filter
            )

        # 2. 전처리 (API/DB 용)
        full_text = "\n".join([b["content"] for b in raw_blocks])

        options = {
            "remove_urls_emails": remove_urls_emails,
            "normalize_whitespace": remove_whitespace,  # 파라미터명 호환
        }
        full_text = self.preprocess_text(full_text, options)

        # 3. 청킹
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

        # 4. 미리보기 형식 반환
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

        # 필터링 적용
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

    def _refine_chunks(
        self,
        raw_blocks: List[Dict[str, Any]],
        override_chunk_size: int = None,
        splitter: Any = None,
    ) -> List[Dict[str, Any]]:
        refined = []

        target_splitter = splitter if splitter else self.text_splitter

        # 청크 사이즈 오버라이드 (DB 대형 Row 처리 등)
        if override_chunk_size is not None:
            target_splitter = RecursiveCharacterTextSplitter(
                chunk_size=override_chunk_size,
                chunk_overlap=self.text_splitter._chunk_overlap,
                separators=self.text_splitter._separators,
                keep_separator=self.text_splitter._keep_separator,
            )

        for block in raw_blocks:
            splits = target_splitter.split_text(block["content"])
            original_meta = block.get("metadata", {})
            for split in splits:
                new_meta = original_meta.copy()
                refined.append({"content": split, "metadata": new_meta})
        return refined

    def _save_to_vector_db(self, doc: Document, chunks: List[Dict[str, Any]]):
        import tiktoken
        from services.llm_service import LLMService
        from utils.encryption import encryption_manager
        from utils.template_utils import count_tokens

        new_chunks = []

        # LLM 클라이언트 초기화 (임베딩 생성용)
        # API Key 오류 등 발생 시 즉시 실패 처리 (상위에서 catch)
        llm_client = None
        if self.user_id:
            llm_client = LLMService.get_client_for_user(
                db=self.db,
                user_id=self.user_id,
                model_id=self.ai_model,  # 예: "text-embedding-3-small"
            )
        else:
            logger.warning("No user_id provided for embedding generation")
            # user_id가 없는 경우도 에러로 처리하거나, 필요하다면 정책 결정.
            # 현재 로직상 user_id 필수.

        # ========================================
        # 토큰 기반 배치 구성
        # ========================================
        MAX_TOKENS_PER_TEXT = 8000  # 개별 텍스트 최대
        MAX_TEXTS_PER_BATCH = 50  # 배치당 최대 텍스트 개수

        batches = []
        current_batch = []

        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            tokens = count_tokens(content)

            # 개별 텍스트 토큰 체크
            if tokens > MAX_TOKENS_PER_TEXT:
                logger.warning(
                    f"Text too long ({tokens} tokens), truncating to {MAX_TOKENS_PER_TEXT}"
                )
                # 토큰 수만큼 자르기
                try:
                    encoding = tiktoken.encoding_for_model(self.ai_model)
                    encoded = encoding.encode(content)
                    truncated = encoded[:MAX_TOKENS_PER_TEXT]
                    content = encoding.decode(truncated)
                    chunk["content"] = content
                except Exception as e:
                    logger.error(f"Failed to truncate text: {e}")

            # 배치 크기 체크
            if len(current_batch) >= MAX_TEXTS_PER_BATCH:
                batches.append(current_batch)
                current_batch = []

            current_batch.append((i, chunk))

        if current_batch:
            batches.append(current_batch)

        # ========================================
        # 배치별 임베딩 생성
        # ========================================
        all_embeddings = {}  # {chunk_index: embedding}

        for batch_idx, batch in enumerate(batches):
            batch_texts = [chunk["content"] for _, chunk in batch]
            batch_indices = [idx for idx, _ in batch]

            # 진행률 업데이트 (임베딩 80% 비중)
            current_processed = sum(len(b) for b in batches[: batch_idx + 1])
            progress = int((current_processed / len(chunks)) * 80)

            # Redis에 진행률 저장
            self._update_progress_redis(doc.id, progress)

            if llm_client:
                # 배치 임베딩 호출 - 실패 시 즉시 에러 발생 (Raise)
                import asyncio
                import inspect

                # embed_batch가 async 함수이므로 동기적으로 결과 실행
                embeddings_result = llm_client.embed_batch(batch_texts)
                if inspect.iscoroutine(embeddings_result):
                    batch_embeddings = asyncio.run(embeddings_result)
                else:
                    batch_embeddings = embeddings_result

                # 인덱스 매핑
                for idx, embedding in zip(batch_indices, batch_embeddings):
                    all_embeddings[idx] = embedding
            else:
                # 여기까지 왔는데 client가 없으면 에러
                raise ValueError("LLM Client initialization failed.")

        # ========================================
        # content 암호화 & DB 저장
        # ========================================
        keyword_error_logged = False
        for i, chunk in enumerate(chunks):
            # 10개마다 진행률 업데이트 (나머지 20% 비중)
            if (i + 1) % 10 == 0 or (i + 1) == len(chunks):
                progress = 80 + int(((i + 1) / len(chunks)) * 20)
                # Redis에 진행률 저장
                self._update_progress_redis(doc.id, progress)

            content = chunk["content"]
            embedding = all_embeddings.get(i)

            if not embedding:
                # 이론상 발생 불가하지만 안전장치
                raise ValueError(f"Embedding not found for chunk {i}")

            # Keyword Extraction (for Hybrid Search)
            keywords = []
            try:
                import nltk
                from rake_nltk import Rake

                try:
                    nltk.data.find("tokenizers/punkt")
                except LookupError:
                    nltk.download("punkt", quiet=True)
                try:
                    nltk.data.find("corpora/stopwords")
                except LookupError:
                    nltk.download("stopwords", quiet=True)

                r = Rake()
                r.extract_keywords_from_text(content)
                keywords = r.get_ranked_phrases()[:10]
            except Exception as e:
                # 키워드 추출 실패는 치명적이지 않음 (로그만 남김)
                if not keyword_error_logged:
                    logger.warning(f"Keyword extraction failed: {e}")
                    keyword_error_logged = True

            # 메타데이터에 키워드 추가
            chunk_metadata = chunk.get("metadata", {}) or {}
            chunk_metadata["keywords"] = keywords

            # Content 전체 암호화
            try:
                encrypted_content = encryption_manager.encrypt(content)
            except Exception as e:
                logger.error(f"Failed to encrypt content for chunk {i}: {e}")
                # 암호화 실패는 치명적일 수 있으나, 일단 원문 저장할지? -> 보안상 실패가 나을 수도.
                # 현재 로직 유지 (원문 저장) 하되, 이번 Fix 범위 밖.
                encrypted_content = content

            new_chunk = DocumentChunk(
                document_id=doc.id,
                knowledge_base_id=doc.knowledge_base_id,
                content=encrypted_content,
                chunk_index=i,
                token_count=chunk.get("token_count", 0),
                metadata_=chunk_metadata,
                embedding=embedding,
            )
            new_chunks.append(new_chunk)

        # !!! CRITICAL: 기존 청크 삭제를 맨 마지막에 수행 (Atomic-like behavior) !!!
        # 임베딩 생성 중 실패하면 삭제되지 않음.
        self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == doc.id
        ).delete()

        self.db.bulk_save_objects(new_chunks)

        # 임베딩 생성 시 사용한 모델명 저장
        doc.embedding_model = self.ai_model
        self.db.add(doc)

        self.db.commit()

    def _update_status(
        self,
        document_id: UUID,
        status: str,
        error_message: str = None,
        progress: int = None,
    ):
        doc = self.db.query(Document).get(document_id)
        if doc:
            doc.status = status
            doc.error_message = error_message
            doc.updated_at = datetime.now(timezone.utc)

            # 진행률 업데이트 (meta_info 활용)
            if progress is not None:
                new_meta = dict(doc.meta_info or {})
                new_meta["progress"] = progress
                doc.meta_info = new_meta

            self.db.commit()

    def reindex_knowledge_base(self, kb_id: UUID, new_model: str):
        """
        KB의 모든 문서를 새 임베딩 모델로 재인덱싱
        """
        self.ai_model = new_model

        documents = (
            self.db.query(Document).filter(Document.knowledge_base_id == kb_id).all()
        )

        if not documents:
            logger.warning(f"No documents found for KB {kb_id}")
            return

        for doc in documents:
            try:
                self._update_status(doc.id, "pending")
                self.process_document(doc.id)
            except Exception as e:
                logger.error(f"Failed to re-index document {doc.id}: {e}")
                self._update_status(doc.id, "failed", str(e))

    def preprocess_text(self, text: str, options: Dict[str, Any]) -> str:
        """
        RAG를 위한 텍스트 전처리

        Args:
            text: 원본 텍스트
            options: 전처리 옵션
                - remove_urls_emails: URL/이메일 제거 (기본: False)
                - normalize_whitespace: 공백 정규화 (기본: True)
                - remove_markdown_separators: 마크다운 구분자 제거 (기본: True)
                - remove_control_chars: 제어 문자 제거 (기본: True)

        Returns:
            전처리된 텍스트
        """
        # === 필수 전처리 (항상 적용) ===

        # 1. 유니코드 정규화 (한글 자모 분리 방지)
        text = unicodedata.normalize("NFC", text)

        # === 선택적 전처리 ===

        # 2. 마크다운 구분자 처리 (LlamaParse 출력용)
        if options.get("remove_markdown_separators", True):
            # 수평선을 단일 줄바꿈으로 변환
            text = re.sub(r"^-{3,}$", "\n", text, flags=re.MULTILINE)
            text = re.sub(r"^\*{3,}$", "\n", text, flags=re.MULTILINE)
            text = re.sub(r"^={3,}$", "\n", text, flags=re.MULTILINE)

        # 3. URL/이메일 제거
        if options.get("remove_urls_emails", False):
            # URL 제거 (http, https, ftp, ftps)
            text = re.sub(
                r"(?:https?|ftps?)://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
                "",
                text,
            )
            # 이메일 제거
            text = re.sub(r"[\w\.-]+@[\w\.-]+\.\w+", "", text)

        # 4. 공백 정규화
        if options.get("normalize_whitespace", True):
            # 단일 공백
            text = re.sub(r"[ \t]+", " ", text)
            # 과도한 줄바꿈 (3줄 이상 → 2줄)
            text = re.sub(r"\n{3,}", "\n\n", text)
            # 줄 끝 공백 제거
            text = re.sub(r"[ \t]+\n", "\n", text)
            # 줄 시작 공백 제거
            text = re.sub(r"\n[ \t]+", "\n", text)

        # 5. 제어 문자 제거 (탭, 줄바꿈 제외)
        if options.get("remove_control_chars", True):
            text = "".join(
                char
                for char in text
                if unicodedata.category(char)[0] != "C" or char in "\n\t"
            )

        # === 필수 전처리 (마무리) ===

        # 6. 앞뒤 공백 제거
        text = text.strip()

        return text
