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
        청크 리스트를 받아 임베딩 후 DB에 저장
        """
        doc = self.db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise ValueError(f"Document {document_id} not found")

        if not chunks:
            logger.warning(f"[벡터저장] 저장할 청크 없음: 문서 {document_id}")
            return

        logger.info(f"[벡터저장] {len(chunks)}개 청크 저장 시작: 문서 {document_id}")

        # 1. 배치 구성 (임베딩 비용 효율화)
        MAX_TOKENS_PER_TEXT = 8000
        MAX_TEXTS_PER_BATCH = 50

        batches = []
        current_batch = []

        try:
            encoding = tiktoken.encoding_for_model(model_name)
        except Exception:
            encoding = tiktoken.get_encoding("cl100k_base")

        for i, chunk in enumerate(chunks):
            content = chunk["content"]

            # 토큰 제한
            tokens = len(encoding.encode(content))
            if tokens > MAX_TOKENS_PER_TEXT:
                logger.warning(
                    f"Truncating chunk {i}: {tokens} > {MAX_TOKENS_PER_TEXT}"
                )
                encoded = encoding.encode(content)
                content = encoding.decode(encoded[:MAX_TOKENS_PER_TEXT])
                chunk["content"] = content
                chunk["token_count"] = MAX_TOKENS_PER_TEXT
            else:
                chunk["token_count"] = tokens

            if len(current_batch) >= MAX_TEXTS_PER_BATCH:
                batches.append(current_batch)
                current_batch = []

            current_batch.append((i, chunk))

        if current_batch:
            batches.append(current_batch)

        # 2. 임베딩 생성 & 저장
        all_embeddings = {}

        for batch in batches:
            texts = [c["content"] for _, c in batch]
            indices = [idx for idx, _ in batch]

            try:
                embeddings = self.embedding_service.embed_batch(texts, model=model_name)
                for idx, emb in zip(indices, embeddings):
                    all_embeddings[idx] = emb
            except Exception as e:
                logger.error(f"[벡터저장] 임베딩 실패: {e}")
                # 임베딩 실패 시 기존 데이터 보존을 위해 예외 발생
                raise RuntimeError(f"임베딩 생성 실패로 동기화 중단: {e}")

        # 3. DocumentChunk 생성
        new_chunks = []
        for i, chunk in enumerate(chunks):
            content = chunk["content"]
            embedding = all_embeddings.get(i, [0.0] * 1536)

            # 메타데이터 구성 (Keywords 등은 여기서 제외 - 필요시 외부에서 주입)
            metadata = chunk.get("metadata", {})

            # 암호화
            try:
                encrypted_content = encryption_manager.encrypt(content)
            except Exception:
                encrypted_content = content

            new_chunks.append(
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

        # 임베딩 성공 시에만 기존 청크 삭제 후 저장 (원자성 보장)
        self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).delete()
        logger.info(f"[벡터저장] 기존 청크 삭제: 문서 {document_id}")

        self.db.bulk_save_objects(new_chunks)

        # 문서 상태 업데이트 (모델명 등)
        doc.embedding_model = model_name
        self.db.commit()

        logger.info(f"[벡터저장] {len(new_chunks)}개 청크 저장 완료")
