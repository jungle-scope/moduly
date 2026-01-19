import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from apps.shared.db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from apps.shared.db.models.llm import LLMCredential, LLMModel, LLMProvider
from apps.shared.schemas.rag import ChunkPreview, RAGResponse
from apps.workflow_engine.services.llm_service import LLMService
from apps.workflow_engine.utils.encryption import encryption_manager

logger = logging.getLogger(__name__)


class RetrievalService:
    def __init__(self, db: Session, user_id):
        self.db = db
        self.user_id = user_id
        self.llm_client = None

    def _get_efficient_rewrite_model(self) -> str:
        """
        사용자의 credential을 확인하여 가장 효율적인(가성비) 모델을 반환합니다.
        Fallback: gpt-4o-mini
        """
        try:
            credentials = (
                self.db.query(LLMCredential)
                .filter(
                    LLMCredential.user_id == self.user_id,
                    LLMCredential.is_valid == True,
                )
                .all()
            )

            if not credentials:
                return "gpt-4o-mini"

            cred_map = {c.provider_id: c for c in credentials}
            providers = (
                self.db.query(LLMProvider)
                .filter(LLMProvider.id.in_(cred_map.keys()))
                .all()
            )

            provider_map = {p.id: p.name.lower() for p in providers}
            available_providers = set(provider_map.values())

            preferred_order = ["openai", "anthropic", "google"]

            for pref in preferred_order:
                if pref in available_providers:
                    model = LLMService.EFFICIENT_MODELS.get(pref)
                    if model:
                        return model

            for prov_name in available_providers:
                model = LLMService.EFFICIENT_MODELS.get(prov_name)
                if model:
                    return model

            return "gpt-4o-mini"

        except Exception as e:
            logger.warning(f"[Model Selection Error] Using default: {e}")
            return "gpt-4o-mini"

    async def _rewrite_query(self, query: str) -> str:
        """
        LLM을 사용하여 검색 쿼리를 최적화합니다. (Query Rewriting, 비동기)
        """
        try:
            rewrite_model_id = self._get_efficient_rewrite_model()
            client = LLMService.get_client_for_user(
                self.db, self.user_id, rewrite_model_id
            )

            system_prompt = (
                "You are a search optimization expert. Rewrite the user's query to maximize relevance for a vector search engine.\n"
                "Rules:\n"
                "1. Detect the language of the original query and rewrite in the SAME language.\n"
                "2. Include synonyms and specific keywords.\n"
                "3. Remove unnecessary stopwords.\n"
                "4. Keep technical terms and proper nouns in their original language (usually English) if they are critical for search.\n"
                "5. Do NOT distort the original intent.\n"
                "6. Output ONLY the rewritten query."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original Query: {query}"},
            ]
            response = await client.invoke(messages, max_tokens=200)
            rewritten_query = response["choices"][0]["message"]["content"].strip()

            if rewritten_query.startswith('"') and rewritten_query.endswith('"'):
                rewritten_query = rewritten_query[1:-1]

            return rewritten_query

        except Exception as e:
            logger.error(f"Failed to rewrite query: {e}")
            return query

    async def _generate_multi_queries(
        self, query: str, num_variations: int = 3
    ) -> list[str]:
        """
        Multi-Query Expansion: LLM을 사용하여 원본 질문의 다양한 변형을 생성합니다. (비동기)
        """
        try:
            rewrite_model_id = self._get_efficient_rewrite_model()
            client = LLMService.get_client_for_user(
                self.db, self.user_id, rewrite_model_id
            )

            system_prompt = (
                f"You are an expert research assistant. Generate {num_variations} different search queries that would help find information to answer the user's question.\n"
                "Each query should approach the question from a different angle or focus on different aspects.\n"
                "Rules:\n"
                "1. Each query should be in the same language as the original question.\n"
                "2. Focus on different entities, concepts, or relationships.\n"
                "3. Keep queries short and search-friendly (3-8 words each).\n"
                f"4. Output ONLY the queries, one per line, numbered 1-{num_variations}."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original Question: {query}"},
            ]
            response = await client.invoke(messages, max_tokens=500)
            content = response["choices"][0]["message"]["content"].strip()

            queries = []
            for line in content.split("\n"):
                line = line.strip()
                if line and any(
                    line.startswith(f"{i}.") or line.startswith(f"{i})")
                    for i in range(1, num_variations + 1)
                ):
                    query_text = line.lstrip("0123456789.)").strip()
                    if query_text:
                        queries.append(query_text)

            if len(queries) < num_variations:
                queries.append(await self._rewrite_query(query))

            return queries[:num_variations]

        except Exception as e:
            logger.error(f"[Multi-Query] Falling back to single query: {e}")
            return [await self._rewrite_query(query)]

    def _vector_search(self, query_vector: list, knowledge_base_id: str, top_k: int):
        distance_col = DocumentChunk.embedding.cosine_distance(query_vector).label(
            "distance"
        )
        stmt = (
            select(DocumentChunk, Document, distance_col)
            .join(Document)
            .where(Document.knowledge_base_id == knowledge_base_id)
            .order_by(distance_col)
            .limit(top_k)
        )
        return self.db.execute(stmt).all()

    def _keyword_search(self, query: str, knowledge_base_id: str, top_k: int):
        from sqlalchemy import text

        stmt = text("""
            SELECT dc.id, dc.content, dc.metadata, dc.document_id, d.filename,
                   ts_rank(
                       to_tsvector('english', dc.content || ' ' || COALESCE(CAST(dc.metadata->'keywords' AS TEXT), '')),
                       websearch_to_tsquery('english', :query)
                   ) as rank
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE dc.knowledge_base_id = :kb_id
              AND to_tsvector('english', dc.content || ' ' || COALESCE(CAST(dc.metadata->'keywords' AS TEXT), '')) @@ websearch_to_tsquery('english', :query)
            ORDER BY rank DESC
            LIMIT :top_k
        """)
        return self.db.execute(
            stmt, {"query": query, "kb_id": knowledge_base_id, "top_k": top_k}
        ).fetchall()

    def _rrf_fusion(self, vector_results, keyword_results, k=60):
        """
        Reciprocal Rank Fusion
        Score = 1 / (k + rank)
        """
        fused_scores = {}

        for rank, (chunk, doc, distance) in enumerate(vector_results):
            doc_id = str(chunk.id)
            if doc_id not in fused_scores:
                fused_scores[doc_id] = {
                    "score": 0,
                    "chunk": chunk,
                    "doc": doc,
                    "vector_rank": rank,
                }
            fused_scores[doc_id]["score"] += 1.0 / (k + rank + 1)

        for rank, row in enumerate(keyword_results):
            doc_id = str(row[0])
            if doc_id not in fused_scores:

                class DummyChunk:
                    def __init__(self, c_id, content, metadata):
                        self.id = c_id
                        self.content = content
                        self.metadata_ = metadata

                class DummyDoc:
                    def __init__(self, d_id, filename):
                        self.id = d_id
                        self.filename = filename

                chunk = DummyChunk(row[0], row[1], row[2])
                doc = DummyDoc(row[3], row[4])
                fused_scores[doc_id] = {
                    "score": 0,
                    "chunk": chunk,
                    "doc": doc,
                    "keyword_rank": rank,
                }

            fused_scores[doc_id]["score"] += 1.0 / (k + rank + 1)

        sorted_results = sorted(
            fused_scores.values(), key=lambda x: x["score"], reverse=True
        )
        return sorted_results

    def _rerank(self, query: str, candidates: list, top_k: int):
        """
        Cross-Encoder Reranking using MS-MARCO based model.
        """
        if not candidates:
            return candidates

        try:
            from sentence_transformers import CrossEncoder

            model = CrossEncoder(
                "cross-encoder/ms-marco-MiniLM-L-12-v2", max_length=512
            )

            pairs = [(query, item["chunk"].content) for item in candidates]
            scores = model.predict(pairs)

            for i, item in enumerate(candidates):
                item["rerank_score"] = float(scores[i])

            reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)
            return reranked[:top_k]

        except Exception as e:
            logger.error(f"Falling back to original order: {e}")
            return candidates[:top_k]

    async def search_documents(
        self,
        query: str,
        knowledge_base_id: str = None,
        top_k: int = 5,
        threshold: float = 0.15,
        use_rewrite: bool = False,
        hybrid_search: bool = True,
        use_rerank: bool = True,
        use_multi_query: bool = False,
    ) -> list[ChunkPreview]:
        """
        [Public API] Hybrid Search (Vector + Keyword) with optional Multi-Query and Reranking (비동기)
        """
        if not knowledge_base_id:
            logger.error("Missing knowledge_base_id")
            return []

        if use_multi_query:
            queries = await self._generate_multi_queries(query, num_variations=3)
        elif use_rewrite:
            queries = [await self._rewrite_query(query)]
        else:
            queries = [query]

        search_query = queries[0]
        all_candidates = {}

        try:
            kb = (
                self.db.query(KnowledgeBase)
                .filter(KnowledgeBase.id == knowledge_base_id)
                .first()
            )
            if not kb or not kb.embedding_model:
                return []

            model_info = (
                self.db.query(LLMModel)
                .filter(LLMModel.model_id_for_api_call == kb.embedding_model)
                .first()
            )
            if model_info and model_info.type != "embedding":
                return []

            embed_client = LLMService.get_client_for_user(
                self.db, self.user_id, kb.embedding_model
            )

            for i, q in enumerate(queries):
                query_vector = await embed_client.embed(q)
                vector_results = self._vector_search(
                    query_vector, knowledge_base_id, top_k * 10
                )

                if hybrid_search:
                    keyword_results = self._keyword_search(
                        q, knowledge_base_id, top_k * 10
                    )
                    fused = self._rrf_fusion(vector_results, keyword_results)
                else:
                    fused = []
                    for rank, (chunk, doc, distance) in enumerate(vector_results):
                        fused.append(
                            {
                                "score": 1.0 / (60 + rank + 1),
                                "chunk": chunk,
                                "doc": doc,
                            }
                        )

                for item in fused[: top_k * 10]:
                    chunk_id = str(item["chunk"].id)
                    if chunk_id not in all_candidates:
                        all_candidates[chunk_id] = item
                    else:
                        if item["score"] > all_candidates[chunk_id]["score"]:
                            all_candidates[chunk_id] = item

        except Exception as e:
            logger.error(f"Search Failed: {e}")
            raise e

        final_list = []
        merged_candidates = sorted(
            all_candidates.values(), key=lambda x: x["score"], reverse=True
        )

        if hybrid_search or use_multi_query:
            if use_rerank:
                candidates_to_rerank = merged_candidates[:100]
                reranked = self._rerank(query, candidates_to_rerank, top_k)

                for item in reranked:
                    chunk = item["chunk"]
                    doc = item["doc"]
                    rerank_score = item.get("rerank_score", 0.0)
                    rrf_score = item.get("score", 0.0)  # 원본 RRF 점수

                    meta = chunk.metadata_.copy() if chunk.metadata_ else {}
                    meta["search_method"] = (
                        "hybrid+rerank" if hybrid_search else "multi_query+rerank"
                    )
                    meta["rerank_score"] = float(rerank_score)
                    meta["rrf_score"] = float(rrf_score)  # RRF 점수도 저장
                    if use_multi_query:
                        meta["num_queries"] = len(queries)

                    # 암호화된 content 복호화
                    content = self._decrypt_content(chunk.content)

                    final_list.append(
                        ChunkPreview(
                            content=content,
                            document_id=doc.id,
                            filename=doc.filename,
                            page_number=meta.get("page"),
                            similarity_score=float(rerank_score),
                            metadata=meta,
                        )
                    )
            else:
                for item in merged_candidates[:top_k]:
                    chunk = item["chunk"]
                    doc = item["doc"]
                    score = item["score"]

                    meta = chunk.metadata_.copy() if chunk.metadata_ else {}
                    meta["search_method"] = "hybrid" if hybrid_search else "multi_query"
                    meta["rrf_score"] = float(score)
                    if use_multi_query:
                        meta["num_queries"] = len(queries)

                    # 암호화된 content 복호화
                    content = self._decrypt_content(chunk.content)

                    final_list.append(
                        ChunkPreview(
                            content=content,
                            document_id=doc.id,
                            filename=doc.filename,
                            page_number=meta.get("page"),
                            similarity_score=float(score),
                            metadata=meta,
                        )
                    )
        else:
            for chunk, doc, distance in vector_results[:top_k]:
                similarity = 1 - distance
                if similarity < threshold:
                    continue

                # 암호화된 content 복호화
                content = self._decrypt_content(chunk.content)

                final_list.append(
                    ChunkPreview(
                        content=content,
                        document_id=doc.id,
                        filename=doc.filename,
                        page_number=chunk.metadata_.get("page"),
                        similarity_score=float(similarity),
                        metadata={"original_query": query} if use_rewrite else {},
                    )
                )

        return final_list

    def _decrypt_content(self, content: str) -> str:
        """
        암호화된 content를 복호화합니다.
        전체 암호화 또는 부분 암호화 모두 처리합니다.
        """
        if not content:
            return content

        # 전체 암호화 패턴
        if content.startswith("gAAAAAB"):
            try:
                return encryption_manager.decrypt(content)
            except Exception as e:
                logger.warning(f"Failed to decrypt full content: {e}")
                return "[ENCRYPTED CONTENT]"

        # 부분 암호화 패턴 (key: value 형식)
        encrypted_pattern = r"([\w_]+):\s*(gAAAAAB[A-Za-z0-9_-]+={0,2})"

        def decrypt_match(match):
            key = match.group(1)
            encrypted_value = match.group(2)
            try:
                decrypted = encryption_manager.decrypt(encrypted_value)
                return f"{key}: {decrypted}"
            except Exception as e:
                logger.warning(f"Failed to decrypt {key}: {e}")
                return f"{key}: [ENCRYPTED]"

        return re.sub(encrypted_pattern, decrypt_match, content)

    async def retrieve_context(
        self, query: str, knowledge_base_id: str, top_k: int = 5
    ) -> str:
        """
        [Public API] 검색된 문서들의 내용을 하나의 문자열로 합쳐서 반환합니다. (비동기)
        """
        chunks = await self.search_documents(query, knowledge_base_id, top_k)
        if not chunks:
            return ""

        return "\n\n".join([c.content for c in chunks])

    async def generate_answer(
        self, query: str, knowledge_base_id: str, model_id: str = "gpt-4o"
    ) -> RAGResponse:
        """
        [Public API] 검색 + 답변 생성 (Chat Interface용, 비동기)
        """
        relevant_chunks = await self.search_documents(query, knowledge_base_id)

        if not relevant_chunks:
            return RAGResponse(
                answer="해당 질문에 답변할 수 있는 문서를 찾지 못했습니다.",
                references=[],
            )

        context_text = "\n\n".join([c.content for c in relevant_chunks])

        if self.llm_client and self.llm_client.model_id == model_id:
            pass
        else:
            try:
                self.llm_client = LLMService.get_client_for_user(
                    self.db, self.user_id, model_id
                )
            except Exception:
                self.llm_client = None

        if not self.llm_client:
            return RAGResponse(
                answer=f"⚠️ 답변 생성을 위한 모델({model_id})을 찾을 수 없습니다. (Credential 등록 필요)",
                references=[],
            )

        system_prompt = (
            "You are a helpful assistant. Use the following context to answer the user's question.\n"
            "If the answer is not in the context, say you don't know.\n\n"
            f"Context:\n{context_text}"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        try:
            result = await self.llm_client.invoke(messages)
            answer = result["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning(f"LLM Generation Failed: {e}")
            answer = f"오류가 발생하여 답변을 생성할 수 없습니다. ({str(e)})"

        return RAGResponse(answer=answer, references=relevant_chunks)
