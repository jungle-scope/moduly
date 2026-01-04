from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from db.models.llm import LLMModel
from schemas.rag import ChunkPreview, RAGResponse
from services.llm_service import LLMService

class RetrievalService:
    def __init__(self, db: Session, user_id):
        self.db = db
        self.user_id = user_id
        # llm_client는 generate_answer에서 필요 시 로드합니다.
        self.llm_client = None

    def search_documents(self, query: str, knowledge_base_id: str = None, top_k: int = 5, threshold: float = 0.15) -> list[ChunkPreview]:
        """
        [Public API] 사용자의 쿼리를 받아 관련성 높은 문서 청크들을 반환합니다.
        (Query Rewrite 기능은 제거되었습니다.)
        """
        
        # knowledge_base_id가 없으면 빈 리스트 반환 (안전장치)
        if not knowledge_base_id:
            print("[Search] Missing knowledge_base_id")
            return []


        # 1. Query Embedding (Dynamic Provider via LLMClient)
        try:
            # 1-1. KnowledgeBase 조회하여 설정된 Embedding Model ID 확인
            kb = self.db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_base_id).first()
            if not kb or not kb.embedding_model:
                 print(f"[Search ERROR] KB {knowledge_base_id} not found or no embedding model set.")
                 # Fallback: 기존처럼 하드코딩된 모델을 쓸 수도 있으나, 여기서는 에러 로그 후 리턴
                 return []
            
            embedding_model_id = kb.embedding_model

            # 1-2. 모델 타입 검증 (Type Check)
            model_info = self.db.query(LLMModel).filter(LLMModel.model_id_for_api_call == embedding_model_id).first()
            if model_info and model_info.type != 'embedding':
                 print(f"[Search] ⚠️ Model {embedding_model_id} is type '{model_info.type}', not 'embedding'.")
                 return []

            # 1-3. User Client 획득 (해당 모델을 지원하는 Credential 사용)
            embed_client = LLMService.get_client_for_user(self.db, self.user_id, embedding_model_id)

            # 1-4. 임베딩 수행
            query_vector = embed_client.embed(query)
            
        except Exception as e:
            # 에러 원인 파악을 위해 raise
            print(f"[Retrieval Error] Embedding Failed: {e}")
            raise e

        # 2. Vector Search (SQLAlchemy with pgvector)
        distance_col = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
        
        stmt = (
            select(DocumentChunk, Document, distance_col)
            .join(Document)
            .where(Document.knowledge_base_id == knowledge_base_id)
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

    def retrieve_context(self, query: str, knowledge_base_id: str, top_k: int = 5) -> str:
        """
        [Public API] 검색된 문서들의 내용을 하나의 문자열로 합쳐서 반환합니다.
        LLM에게 프롬프트로 넘겨줄 Context 덩어리가 필요할 때 유용합니다.
        """
        chunks = self.search_documents(query, knowledge_base_id, top_k)
        if not chunks:
            return ""
        
        return "\n\n".join([c.content for c in chunks])

    def generate_answer(self, query: str, knowledge_base_id: str, model_id: str = "gpt-4o") -> RAGResponse:
        """
        [Public API] 검색 + 답변 생성 (Chat Interface용)
        Arguments:
            model_id: 답변 생성에 사용할 Chat 모델 ID (default: gpt-4o)
        """

        # Step 1: Search (Reuse public method)
        relevant_chunks = self.search_documents(query, knowledge_base_id)

        # Step 2: Context Construction
        if not relevant_chunks:
            return RAGResponse(
                answer="해당 질문에 답변할 수 있는 문서를 찾지 못했습니다.",
                references=[]
            )

        context_text = "\n\n".join([c.content for c in relevant_chunks])

        # Step 3: LLM Generation (On-Demand Client)
        # 1. 이미 클라이언트가 있고, 그 클라이언트의 모델이 요청된 모델과 같으면 재사용
        if self.llm_client and self.llm_client.model_id == model_id:
            pass
        else:
            # 2. 클라이언트가 없거나 다른 모델을 원하면 새로 로드
            try:
                self.llm_client = LLMService.get_client_for_user(self.db, self.user_id, model_id)
            except Exception as e:
                print(f"[Retrieval] Failed to load generation model {model_id}: {e}")
                self.llm_client = None
        
        if not self.llm_client:
            return RAGResponse(
                answer=f"⚠️ 답변 생성을 위한 모델({model_id})을 찾을 수 없습니다. (Credential 등록 필요)",
                references=[]
            )

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
