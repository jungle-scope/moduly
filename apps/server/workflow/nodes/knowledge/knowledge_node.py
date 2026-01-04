import uuid
import re
from typing import Any, Dict, List, Tuple
from uuid import UUID

from jinja2 import Environment
from sqlalchemy.orm import Session

from db.session import SessionLocal
from schemas.rag import ChunkPreview
from services.retrieval import RetrievalService
from workflow.nodes.base.node import Node

from .entities import KnowledgeNodeData

_jinja_env = Environment(autoescape=False)


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    Template/LLM 노드와 동일한 헬퍼입니다.
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class KnowledgeNode(Node[KnowledgeNodeData]):
    """
    선택된 지식 베이스에서 쿼리(템플릿)를 검색해 컨텍스트와 메타데이터를 반환합니다.
    - 입력 쿼리는 Jinja2로 렌더링
    - 여러 지식 베이스를 순회하며 검색
    - LLM 호출 없음: 다음 노드가 컨텍스트를 활용하도록 결과만 전달
    """

    node_type = "knowledgeNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        # 1) 입력 검증
        self.data.validate()

        # 2) 쿼리 템플릿 렌더링 (변수 치환)
        context = self._build_context(inputs)
        rendered_query = self._render_query(context)

        # 3) 검색 실행
        db_session, temp_session = self._get_db_session()
        try:
            user_id = self._get_user_id()
            retrieval = RetrievalService(db_session, user_id)

            kb_ids = [kb.id for kb in self.data.knowledgeBases if kb.id]
            top_k = self.data.topK or 3
            threshold = (
                self.data.scoreThreshold
                if self.data.scoreThreshold is not None
                else 0.0
            )

            all_chunks: List[Tuple[str, ChunkPreview]] = []
            for kb_id in kb_ids:
                chunks = retrieval.search_documents(
                    rendered_query,
                    knowledge_base_id=kb_id,
                    top_k=top_k,
                    threshold=threshold,
                )
                for chunk in chunks:
                    all_chunks.append((kb_id, chunk))

            # 유사도 순으로 정렬 후 상위 top_k까지 반환
            sorted_chunks = sorted(
                all_chunks,
                key=lambda item: getattr(item[1], "similarity_score", 0),
                reverse=True,
            )
            top_chunks = sorted_chunks[:top_k] if top_k else sorted_chunks

            if not top_chunks:
                return {"context": "", "metadata": []}

            context_text = "\n\n".join([chunk.content for _, chunk in top_chunks])
            metadata = [
                self._serialize_metadata(chunk, kb_id) for kb_id, chunk in top_chunks
            ]

            return {"context": context_text, "metadata": metadata}
        finally:
            if temp_session is not None:
                temp_session.close()

    def _build_context(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        context: Dict[str, Any] = {}
        for variable in self.data.queryVariables:
            var_name = variable.name
            selector = variable.value_selector

            if not var_name or not selector or len(selector) < 1:
                context[var_name] = ""
                continue

            target_node_id = selector[0]
            source_data = inputs.get(target_node_id)
            if source_data is None:
                context[var_name] = ""
                continue

            if len(selector) > 1:
                value = _get_nested_value(source_data, selector[1:])
                context[var_name] = value if value is not None else ""
            else:
                context[var_name] = source_data
        return context

    def _render_query(self, context: Dict[str, Any]) -> str:
        template = (self.data.userQuery or "").strip()
        if not template:
            raise ValueError(
                "입력 쿼리가 비어 있습니다. 쿼리를 입력하거나 템플릿을 완성해주세요."
            )

        # 간단한 괄호 짝 검증으로 미완성 템플릿을 사전에 차단
        if template.count("{{") != template.count("}}"):
            raise ValueError(
                "입력 쿼리 템플릿이 올바르지 않습니다. '{{'와 '}}' 쌍을 확인해주세요."
            )

        # 빈 placeholder '{{ }}' 가 남아 있는 경우 친절하게 안내
        # TODO: 팀 합의 후 빈 placeholder를 무시/제거할지 결정 (현재는 안전을 위해 실패 처리)
        # 실행할때는 변수가 잘 들어가지만, 실제 변수 값이 ""이면 에러가 나는 상황임 현재
        if re.search(r"\{\{\s*\}\}", template):
            raise ValueError(
                "빈 템플릿 placeholder가 있습니다. '{{ 변수명 }}' 형태로 채워주세요."
            )

        try:
            return _jinja_env.from_string(template).render(**context)
        except Exception as e:
            raise ValueError(
                f"쿼리 템플릿 렌더링 실패: {e}. 템플릿 문법과 변수명을 확인해주세요."
            )

    def _get_db_session(self) -> tuple[Session, Session | None]:
        """
        엔진에서 주입된 db 세션을 우선 사용하고, 없으면 임시 세션 생성.
        반환: (session, temp_session) temp_session은 호출자가 닫아야 함.
        """
        db_session = self.execution_context.get("db")
        temp_session = None
        if db_session is None:
            temp_session = SessionLocal()
            db_session = temp_session
        return db_session, temp_session

    def _get_user_id(self):
        user_id = self.execution_context.get("user_id")
        try:
            return uuid.UUID(user_id) if user_id else None
        except Exception:
            return user_id

    def _serialize_metadata(self, chunk: ChunkPreview, kb_id: str) -> Dict[str, Any]:
        data = chunk.dict()
        for key, value in list(data.items()):
            if isinstance(value, UUID):
                data[key] = str(value)
        data["knowledge_base_id"] = str(kb_id)
        return data


import re
