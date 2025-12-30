from sqlalchemy import select
from sqlalchemy.orm import Session
from langchain_openai import OpenAIEmbeddings

from db.models.knowledge import Document, DocumentChunk
from schemas.rag import ChunkPreview, RAGResponse
from services.llm_service import LLMService


# --- Constants ---
QUERY_EXPANSION_SYSTEM_PROMPT = """
You are a query optimizer for the AI service 'Moduly'.
Moduly is an AI workflow automation tool.

Your Task:
Rewrite the user's query to use correct official terminology mostly in English.
Keep the user's original intent clearly.
Output ONLY the rewritten query text.

Term Glossary:
- 모듈리 -> Moduly
- 랙 -> RAG (Retrieval Augmented Generation)
- 워크플로우 -> Workflow
"""

class RetrievalService:
    def __init__(self, db: Session):
        self.db = db
        # 1. LLM 클라이언트 확보 (API Key 획득용)
        # TODO: 실제로는 사용자 ID를 받아와서 해당 사용자의 Provider를 가져와야 함 (현재는 Shared Mode)
        try:
            self.llm_client = LLMService.get_any_provider_client(db)
            self.api_key = self.llm_client.api_key  # OpenAIClient인 경우 api_key 속성 존재
        except Exception as e:
            print(f"[Retrieval] Failed to load LLM Client: {e}")
            self.llm_client = None
            self.api_key = None


    def search_documents(self, query: str, top_k: int = 5, threshold: float = 0.3) -> list[ChunkPreview]:
        """
        [Public API] 지식 베이스 검색 (Vector Search Only)
        다른 노드(예: Knowledge Node)에서 검색 결과만 필요할 때 이 함수를 직접 호출하세요.
        """
        # 0. Query Expansion (Smart Search)
        # 한글 발음(모듈리) -> 영어 키워드(Moduly) 등으로 변환하여 검색 품질 향상
        try:
            expansion_prompt = [
                {"role": "system", "content": QUERY_EXPANSION_SYSTEM_PROMPT},
                {"role": "user", "content": query}
            ]
            # LLM에게 쿼리 최적화 요청
            expanded_resp = self.llm_client.invoke(expansion_prompt)
            rewritten_query = expanded_resp["choices"][0]["message"]["content"].strip()
            print(f"[Search] 🧠 Smart Rewrite: '{query}' -> '{rewritten_query}'")
            
            # 검색어를 변환된 것으로 교체
            query = rewritten_query
        except Exception as e:
            print(f"Query Expansion Failed: {e}")

        # 1. Query Embedding (Real)
        try:
            embeddings_model = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=self.api_key
            )
            query_vector = embeddings_model.embed_query(query)
        except Exception as e:
            print(f"Embedding Failed: {e}")
            return []

        # 2. Vector Search (SQLAlchemy with pgvector)
        # Select distance explicitly to filter by it
        distance_col = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        
        stmt = (
            select(DocumentChunk, Document, distance_col)
            .join(Document)
            .order_by(distance_col)
            .limit(top_k)
        )

        results = self.db.execute(stmt).all()

        previews = []
        for chunk, doc, distance in results:
            # Similarity = 1 - distance
            similarity = 1 - distance
            
            if similarity < threshold:
                continue

            previews.append(
                ChunkPreview(
                    content=chunk.content,
                    document_id=doc.id,
                    filename=doc.filename,
                    page_number=chunk.metadata_.get("page"),
                    similarity_score=float(similarity),
                )
            )

        return previews

    def retrieve_context(self, query: str, top_k: int = 5) -> str:
        """
        [Public API] 검색된 문서들의 내용을 하나의 문자열로 합쳐서 반환합니다.
        LLM에게 프롬프트로 넘겨줄 Context 덩어리가 필요할 때 유용합니다.
        """
        chunks = self.search_documents(query, top_k)
        if not chunks:
            return ""
        
        return "\n\n".join([c.content for c in chunks])

    def generate_answer(self, query: str) -> RAGResponse:
        """
        [Public API] 검색 + 답변 생성 (Chat Interface용)
        """
        if not self.api_key:
            return RAGResponse(
                answer="⚠️ OpenAI API Key가 설정되지 않아 실제 검색을 수행할 수 없습니다.",
                references=[]
            )

        # Step 1: Search (Reuse public method)
        relevant_chunks = self.search_documents(query)

        # Step 2: Context Construction
        if not relevant_chunks:
            return RAGResponse(
                answer="해당 질문에 답변할 수 있는 문서를 찾지 못했습니다.",
                references=[]
            )

        context_text = "\n\n".join([c.content for c in relevant_chunks])

        # Step 3: LLM Generation
        system_prompt = (
            "You are a helpful assistant. Use the following context to answer the user's question.\n"
            "If the answer is not in the context, say you don't know.\n\n"
            f"Context:\n{context_text}"
        )
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]

        try:
            result = self.llm_client.invoke(messages)
            answer = result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM Generation Failed: {e}")
            answer = f"오류가 발생하여 답변을 생성할 수 없습니다. ({str(e)})"

        return RAGResponse(answer=answer, references=relevant_chunks)
