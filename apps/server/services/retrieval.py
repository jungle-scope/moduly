from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk
from schemas.rag import ChunkPreview, RAGResponse


class RetrievalService:
    def __init__(self, db: Session):
        self.db = db

    def generate_answer(self, query: str) -> RAGResponse:
        """
        1. 질문 임베딩
        2. 벡터 검색 (pgvector)
        3. 컨텍스트를 포함한 프롬프트 구성
        4. LLM 호출 (GPT-4o-mini)
        """
        # Step 1: Search
        relevant_chunks = self._search_vectors(query)

        # Step 2: Context Construction
        context_text = "\n\n".join([c.content for c in relevant_chunks])

        # Step 3: LLM Generation
        # system_prompt = f"Use the following context to answer: {context_text}"
        # answer = call_gpt_4o_mini(system_prompt, query)
        answer = "This is a mock answer based on the retrieved context."

        return RAGResponse(answer=answer, references=relevant_chunks)

    def _search_vectors(self, query: str, top_k: int = 5) -> list[ChunkPreview]:
        """
        Performs Cosine Similarity search using pgvector operator (<=> or 1 - cosine).
        """
        # query_vector = get_embedding(query)  # TODO: Implement Embedding
        # mocked for skeleton
        query_vector = [0.1] * 1536

        # SQLAlchemy with pgvector
        # 거리순 정렬 (L2 또는 Cosine 거리)
        stmt = (
            select(DocumentChunk, Document)
            .join(Document)
            .order_by(DocumentChunk.embedding.cosine_distance(query_vector))
            .limit(top_k)
        )

        results = self.db.execute(stmt).all()

        previews = []
        for chunk, doc in results:
            previews.append(
                ChunkPreview(
                    content=chunk.content,
                    document_id=doc.id,
                    filename=doc.filename,
                    page_number=chunk.metadata_.get("page"),
                    similarity_score=0.95,  # Mock score
                )
            )

        return previews
