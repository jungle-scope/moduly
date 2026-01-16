import logging
from typing import Any, Dict, List
from uuid import UUID

import tiktoken
from apps.shared.db.models.knowledge import Document, DocumentChunk
from apps.shared.services.embedding_service import EmbeddingService
from apps.shared.utils.encryption import encryption_manager
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class VectorStoreService:
    """
    [Shared] 벡터 저장소 서비스
    - DocumentChunk 저장, 임베딩 생성 및 저장 담당
    - IngestionOrchestrator(Gateway)와 SyncService(WorkflowEngine)에서 공통 사용
    """

    def __init__(self, db: Session, user_id: UUID):
        self.db = db
        self.user_id = user_id
        self.embedding_service = EmbeddingService(db, user_id)

    def save_chunks(
        self,
        document_id: UUID,
        chunks: List[Dict[str, Any]],
        model_name: str = "text-embedding-3-small",
    ):
        """
        청크 리스트를 받아 증분 업데이트(Incremental Update) 방식으로 저장
        1. 기존 청크 로드 및 해시 맵핑 (복호화 필요)
        2. 해시 비교를 통해 변경된 청크만 선별 임베딩 (비용 절감)
        3. 기존 청크 삭제 후 일괄 저장 (원자성 보장)
        """
        import hashlib

        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        if not chunks:
            logger.warning(f"[벡터저장] 저장할 청크 없음: 문서 {document_id}")
            return

        logger.info(f"[벡터저장] {len(chunks)}개 청크 처리 시작: 문서 {document_id}")

        # 1. 기존 청크 로드 및 해시 맵 구축
        existing_chunks = (
            self.db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .all()
        )
        existing_map = {}

        for chunk in existing_chunks:
            try:
                # DB 내용은 암호화되어 있을 수 있으므로 복호화 시도
                decrypted_content = encryption_manager.decrypt(chunk.content)
            except Exception:
                # 복호화 실패(평문이거나 키 불일치) 시 원본 사용
                decrypted_content = chunk.content

            # SHA-256 해시 생성 (내용 비교용)
            chunk_hash = hashlib.sha256(decrypted_content.encode("utf-8")).hexdigest()
            existing_map[chunk_hash] = chunk.embedding

        # 2. 임베딩 대상 분류 (해시 비교)
        final_embeddings = {}  # index -> embedding
        chunks_to_embed = []  # (index, content)
        reused_count = 0

        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            chunk_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

            if chunk_hash in existing_map:
                # 동일, 기존 벡터 재사용.
                final_embeddings[i] = existing_map[chunk_hash]
                reused_count += 1
            else:
                # 변경됨, Embedding API 호출 대상.
                chunks_to_embed.append((i, content))

        if reused_count > 0:
            logger.info(
                f"[벡터저장] {reused_count}개 청크 재사용 (절감 효과!) / {len(chunks_to_embed)}개 신규 임베딩"
            )

        # 3. 신규 청크 임베딩 (Batch Processing)
        if chunks_to_embed:
            MAX_TOKENS_PER_TEXT = 8000
            MAX_TEXTS_PER_BATCH = 50

            try:
                encoding = tiktoken.encoding_for_model(model_name)
            except Exception:
                encoding = tiktoken.get_encoding("cl100k_base")

            # 임베딩 대상만 배치 구성
            batches = []
            current_batch = []

            for idx, content in chunks_to_embed:
                # 토큰 제한 처리
                tokens = len(encoding.encode(content))
                if tokens > MAX_TOKENS_PER_TEXT:
                    logger.warning(
                        f"Truncating chunk {idx}: {tokens} > {MAX_TOKENS_PER_TEXT}"
                    )
                    encoded = encoding.encode(content)
                    content = encoding.decode(encoded[:MAX_TOKENS_PER_TEXT])
                    # 원본 chunks 리스트에도 반영 (저장 시 사용)
                    chunks[idx]["content"] = content
                    chunks[idx]["token_count"] = MAX_TOKENS_PER_TEXT
                else:
                    chunks[idx]["token_count"] = tokens

                if len(current_batch) >= MAX_TEXTS_PER_BATCH:
                    batches.append(current_batch)
                    current_batch = []

                current_batch.append((idx, content))

            if current_batch:
                batches.append(current_batch)

            # API 호출
            for batch in batches:
                texts = [c for _, c in batch]
                indices = [idx for idx, _ in batch]

                try:
                    embeddings = self.embedding_service.embed_batch(
                        texts, model=model_name
                    )
                    for idx, emb in zip(indices, embeddings):
                        final_embeddings[idx] = emb
                except Exception as e:
                    logger.error(f"[벡터저장] 임베딩 실패: {e}")
                    raise RuntimeError(f"임베딩 생성 실패로 동기화 중단: {e}")

        # 4. DocumentChunk 저장 (Atomic Swap)
        new_document_chunks = []
        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            embedding = final_embeddings.get(i)

            if embedding is None:
                # 이론상 발생하면 안 되지만 안전장치
                logger.error(f"Missing embedding for chunk {i}")
                continue

            metadata = chunk.get("metadata", {})

            # 암호화
            try:
                encrypted_content = encryption_manager.encrypt(content)
            except Exception:
                encrypted_content = content

            new_document_chunks.append(
                DocumentChunk(
                    document_id=doc.id,
                    knowledge_base_id=doc.knowledge_base_id,
                    content=encrypted_content,
                    chunk_index=i,
                    token_count=chunk.get("token_count", 0),
                    metadata_=metadata,
                    embedding=embedding,
                )
            )

        # 기존 청크 삭제 후 저장
        self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).delete()

        self.db.bulk_save_objects(new_document_chunks)

        doc.embedding_model = model_name
        self.db.commit()

        logger.info(f"[벡터저장] 총 {len(new_document_chunks)}개 청크 저장 완료")
