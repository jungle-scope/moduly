from sqlalchemy import select
from sqlalchemy.orm import Session

from db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from db.models.llm import LLMCredential, LLMProvider
from schemas.rag import ChunkPreview, RAGResponse
from services.llm_service import LLMService


class RetrievalService:
    def __init__(self, db: Session, user_id):
        self.db = db
        self.user_id = user_id
        # llm_client는 generate_answer에서 필요 시 로드합니다.
        self.llm_client = None

    def _get_efficient_rewrite_model(self) -> str:
        """
        사용자의 credential을 확인하여 가장 효율적인(가성비) 모델을 반환합니다.
        Fallback: gpt-4o-mini
        """
        try:
            # 1. 사용자의 유효한 Credential 조회
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

            # 2. Provider 정보 조회
            cred_map = {c.provider_id: c for c in credentials}
            providers = (
                self.db.query(LLMProvider)
                .filter(LLMProvider.id.in_(cred_map.keys()))
                .all()
            )

            provider_map = {p.id: p.name.lower() for p in providers}
            available_providers = set(provider_map.values())

            # 3. 우선순위에 따라 효율적인 모델 찾기 (OpenAI -> Anthropic -> Google)
            preferred_order = ["openai", "anthropic", "google"]

            for pref in preferred_order:
                if pref in available_providers:
                    model = LLMService.EFFICIENT_MODELS.get(pref)
                    if model:
                        return model

            # 선호 순서에 없어도 사용 가능한 Provider 있으면 반환
            for prov_name in available_providers:
                model = LLMService.EFFICIENT_MODELS.get(prov_name)
                if model:
                    return model

            return "gpt-4o-mini"

        except Exception as e:
            print(f"[Model Selection Error] Using default: {e}")
            return "gpt-4o-mini"

    def _rewrite_query(self, query: str) -> str:
        """
        LLM을 사용하여 검색 쿼리를 최적화합니다. (Query Rewriting)
        동의어 확장, 모호성 제거, 핵심 키워드 추출 등을 수행합니다.
        """
        try:
            # Query Rewriting에는 빠르고 저렴한 모델 자동 선택
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

            # Security Fix: System prompt separation to prevent injection
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original Query: {query}"},
            ]
            response = client.invoke(messages, max_tokens=200)
            rewritten_query = response["choices"][0]["message"]["content"].strip()

            # 따옴표 제거 등 전처리
            if rewritten_query.startswith('"') and rewritten_query.endswith('"'):
                rewritten_query = rewritten_query[1:-1]

            print(
                f"[Query Rewrite] Original: '{query}' -> Rewritten: '{rewritten_query}'"
            )
            return rewritten_query

        except Exception as e:
            print(f"[Query Rewrite Error] Failed to rewrite query: {e}")
            return query  # 실패 시 원본 쿼리 사용

    def _generate_multi_queries(self, query: str, num_variations: int = 3) -> list[str]:
        """
        Multi-Query Expansion: LLM을 사용하여 원본 질문의 다양한 변형을 생성합니다.
        다양한 관점에서 문서를 검색하여 recall을 높입니다.
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
                "4. Output ONLY the queries, one per line, numbered 1-{num_variations}."
            )

            # Security Fix: System prompt separation
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Original Question: {query}"},
            ]
            response = client.invoke(messages, max_tokens=500)
            content = response["choices"][0]["message"]["content"].strip()

            # Parse numbered queries
            queries = []
            for line in content.split("\n"):
                line = line.strip()
                if line and any(
                    line.startswith(f"{i}.") or line.startswith(f"{i})")
                    for i in range(1, num_variations + 1)
                ):
                    # Remove number prefix
                    query_text = line.lstrip("0123456789.)").strip()
                    if query_text:
                        queries.append(query_text)

            # Always include original rewritten query
            if len(queries) < num_variations:
                queries.append(self._rewrite_query(query))

            print(f"[Multi-Query] Generated {len(queries)} queries: {queries[:3]}")
            return queries[:num_variations]

        except Exception as e:
            print(f"[Multi-Query Error] Falling back to single query: {e}")
            return [self._rewrite_query(query)]

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

        # PostgreSQL websearch_to_tsquery for simple boolean logic (e.g. "apple -iphone")
        # Ranking by ts_rank
        # [IMPROVEMENT] Also search in metadata keywords (converted to text)
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

        # 1. Process Vector Results
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

        # 2. Process Keyword Results
        # keyword_results: [(id, content, metadata, doc_id, filename, rank), ...]
        for rank, row in enumerate(keyword_results):
            doc_id = str(row[0])
            if doc_id not in fused_scores:
                # We need to construct dummy objects if not present in vector results
                # But for simplicity, we only fuse. If keyword-only found, we need to fetch object?
                # row structure match is tricky. Let's create a temporary object structure.
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

        # 3. Sort by fused score
        sorted_results = sorted(
            fused_scores.values(), key=lambda x: x["score"], reverse=True
        )
        return sorted_results

    def _rerank(self, query: str, candidates: list, top_k: int):
        """
        Cross-Encoder Reranking using MS-MARCO based model.
        Takes Hybrid Search candidates and re-scores them based on semantic relevance.
        """
        if not candidates:
            return candidates

        try:
            from sentence_transformers import CrossEncoder

            # Load model (will cache after first load)
            # ms-marco-MiniLM-L-12-v2 is more accurate (12 layers vs 6)
            model = CrossEncoder(
                "cross-encoder/ms-marco-MiniLM-L-12-v2", max_length=512
            )

            # Prepare (query, passage) pairs
            pairs = [(query, item["chunk"].content) for item in candidates]

            # Score all pairs
            scores = model.predict(pairs)

            # Attach scores and sort
            for i, item in enumerate(candidates):
                item["rerank_score"] = float(scores[i])

            reranked = sorted(candidates, key=lambda x: x["rerank_score"], reverse=True)

            print(
                f"[Rerank] Top-3 scores: {[round(x['rerank_score'], 4) for x in reranked[:3]]}"
            )

            return reranked[:top_k]

        except Exception as e:
            print(f"[Rerank Error] Falling back to original order: {e}")
            return candidates[:top_k]

    def search_documents(
        self,
        query: str,
        knowledge_base_id: str = None,
        top_k: int = 5,
        threshold: float = 0.15,
        use_rewrite: bool = False,
        hybrid_search: bool = True,
        use_rerank: bool = False,
        use_multi_query: bool = False,
    ) -> list[ChunkPreview]:
        """
        [Public API] Hybrid Search (Vector + Keyword) with optional Multi-Query and Reranking
        """
        if not knowledge_base_id:
            print("[Search] Missing knowledge_base_id")
            return []

        # Multi-Query Expansion: Generate multiple query variations
        if use_multi_query:
            queries = self._generate_multi_queries(query, num_variations=3)
        elif use_rewrite:
            queries = [self._rewrite_query(query)]
        else:
            queries = [query]

        search_query = queries[0]  # Primary query for single-query mode

        # Prepare for multi-query merging
        all_candidates = {}  # chunk_id -> candidate item

        try:
            kb = (
                self.db.query(KnowledgeBase)
                .filter(KnowledgeBase.id == knowledge_base_id)
                .first()
            )
            if not kb or not kb.embedding_model:
                return []

            # Model Type Validation
            from db.models.llm import LLMModel

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

            # Multi-Query: Loop through all query variations
            for i, q in enumerate(queries):
                # 1. Vector Search for this query
                query_vector = embed_client.embed(q)
                vector_results = self._vector_search(
                    query_vector, knowledge_base_id, top_k * 10
                )

                if hybrid_search:
                    # 2. Keyword Search for this query
                    keyword_results = self._keyword_search(
                        q, knowledge_base_id, top_k * 10
                    )

                    # 3. Fuse results for this query
                    fused = self._rrf_fusion(vector_results, keyword_results)
                else:
                    # Vector-only: convert to same format
                    fused = []
                    for rank, (chunk, doc, distance) in enumerate(vector_results):
                        fused.append(
                            {
                                "score": 1.0 / (60 + rank + 1),
                                "chunk": chunk,
                                "doc": doc,
                            }
                        )

                # 4. Merge into all_candidates (deduplicate by chunk ID, keep best score)
                # Ensure we process ALL candidates retrieved (top_k * 10)
                for item in fused[: top_k * 10]:
                    chunk_id = str(item["chunk"].id)
                    if chunk_id not in all_candidates:
                        all_candidates[chunk_id] = item
                    else:
                        # Keep the higher score (Max-Pooling) to avoid diluting strong signals
                        if item["score"] > all_candidates[chunk_id]["score"]:
                            all_candidates[chunk_id] = item

        except Exception as e:
            print(f"[Retrieval Error] Search Failed: {e}")
            raise e

        # 2. Finalize: Sort merged candidates and proceed
        final_list = []
        merged_candidates = sorted(
            all_candidates.values(), key=lambda x: x["score"], reverse=True
        )

        if hybrid_search or use_multi_query:
            # [NEW] Optional Reranking
            if use_rerank:
                # Rerank Top-100 candidates using Cross-Encoder
                candidates_to_rerank = merged_candidates[:100]
                reranked = self._rerank(query, candidates_to_rerank, top_k)

                for item in reranked:
                    chunk = item["chunk"]
                    doc = item["doc"]
                    rerank_score = item.get("rerank_score", 0.0)

                    meta = chunk.metadata_.copy() if chunk.metadata_ else {}
                    meta["search_method"] = (
                        "hybrid+rerank" if hybrid_search else "multi_query+rerank"
                    )
                    meta["rerank_score"] = float(rerank_score)
                    if use_multi_query:
                        meta["num_queries"] = len(queries)

                    final_list.append(
                        ChunkPreview(
                            content=chunk.content,
                            document_id=doc.id,
                            filename=doc.filename,
                            page_number=meta.get("page"),
                            similarity_score=float(rerank_score),
                            metadata=meta,
                        )
                    )
            else:
                # Standard Hybrid (No Reranking)
                for item in merged_candidates[:top_k]:
                    chunk = item["chunk"]
                    doc = item["doc"]
                    score = item["score"]  # RRF score (not probability)

                    # Metadata annotation
                    meta = chunk.metadata_.copy() if chunk.metadata_ else {}
                    meta["search_method"] = "hybrid" if hybrid_search else "multi_query"
                    meta["rrf_score"] = float(score)
                    if use_multi_query:
                        meta["num_queries"] = len(queries)

                    final_list.append(
                        ChunkPreview(
                            content=chunk.content,
                            document_id=doc.id,
                            filename=doc.filename,
                            page_number=meta.get("page"),
                            similarity_score=float(score),  # Using RRF score as proxy
                            metadata=meta,
                        )
                    )
        else:
            # Legacy Vector Only
            for chunk, doc, distance in vector_results[:top_k]:
                similarity = 1 - distance
                if similarity < threshold:
                    continue
                final_list.append(
                    ChunkPreview(
                        content=chunk.content,
                        document_id=doc.id,
                        filename=doc.filename,
                        page_number=chunk.metadata_.get("page"),
                        similarity_score=float(similarity),
                        metadata={"original_query": query} if use_rewrite else {},
                    )
                )

        return final_list

    def retrieve_context(
        self, query: str, knowledge_base_id: str, top_k: int = 5
    ) -> str:
        """
        [Public API] 검색된 문서들의 내용을 하나의 문자열로 합쳐서 반환합니다.
        LLM에게 프롬프트로 넘겨줄 Context 덩어리가 필요할 때 유용합니다.
        """
        chunks = self.search_documents(query, knowledge_base_id, top_k)
        if not chunks:
            return ""

        return "\n\n".join([c.content for c in chunks])

    def generate_answer(
        self, query: str, knowledge_base_id: str, model_id: str = "gpt-4o"
    ) -> RAGResponse:
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
                references=[],
            )

        context_text = "\n\n".join([c.content for c in relevant_chunks])

        # Step 3: LLM Generation (On-Demand Client)
        # 1. 이미 클라이언트가 있고, 그 클라이언트의 모델이 요청된 모델과 같으면 재사용
        if self.llm_client and self.llm_client.model_id == model_id:
            pass
        else:
            # 2. 클라이언트가 없거나 다른 모델을 원하면 새로 로드
            try:
                self.llm_client = LLMService.get_client_for_user(
                    self.db, self.user_id, model_id
                )
            except Exception as e:
                print(f"[Retrieval] Failed to load generation model {model_id}: {e}")
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
            result = self.llm_client.invoke(messages)
            answer = result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"LLM Generation Failed: {e}")
            answer = f"오류가 발생하여 답변을 생성할 수 없습니다. ({str(e)})"

        return RAGResponse(answer=answer, references=relevant_chunks)
