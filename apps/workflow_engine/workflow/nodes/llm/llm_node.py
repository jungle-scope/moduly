import json
import uuid
from typing import Any, Dict, List, Optional

from jinja2 import Environment

from apps.shared.db.models.llm import LLMModel
from apps.shared.db.models.workflow_run import RunStatus, WorkflowNodeRun, WorkflowRun
from apps.shared.db.session import SessionLocal  # 임시 세션 생성용
from apps.shared.schemas.rag import ChunkPreview
from apps.workflow_engine.services.llm_service import LLMService
from apps.workflow_engine.services.retrieval import RetrievalService

from ..base.node import Node
from .entities import LLMNodeData

_jinja_env = Environment(autoescape=False)
MEMORY_RUN_LIMIT = 5  # 최근 실행 몇 건을 기억 컨텍스트에 반영할지 결정
SUMMARY_MODEL_PREFS = {
    "openai": ["gpt-4.1-mini", "gpt-4o-mini", "gpt-3.5-turbo"],
    "google": ["gemini-1.5-flash", "gemini-1.5-pro"],
    "anthropic": ["claude-3-haiku-20240307", "claude-3-5-sonnet-20240620"],
}


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    Template 노드와 동일한 헬퍼 함수.
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class LLMNode(Node[LLMNodeData]):
    """
    정의: 입력/프롬프트를 조합해 LLM을 호출하고 답변을 생성하는 노드.

    제약사항(요구사항 정리):
    - 프롬프트 안에 최소 하나 이상의 텍스트 또는 참조 변수가 있어야 함.
    - 모델 선택 시: 등록된 API key가 있는 모델만 허용.
    - 변수 참조: 이전 노드에서 생성된 변수만 사용 가능.
    - 상세 기능: 모델 선택, 시스템/유저/어시스턴트 프롬프트, 컨텍스트(RAG) 전달.
    """

    node_type = "llmNode"

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        LLM 노드의 실제 실행 로직 구현 (비동기)

        Args:
            inputs: 이전 노드 결과 합친 dict (변수 풀)
        Returns:
            LLM 결과를 담은 dict (예: {"text": "...", "usage": {...}})
        """

        # STEP 1. 필수값 검증 -------------------------------------------------
        self.data.validate()

        # STEP 2. 모델 준비 ----------------------------------------------------
        # TODO: per-user provider/credential로 교체 필요
        # 현재는 임시 모드: DB에서 아무 provider/credential을 가져와 클라이언트 생성
        # - 엔진이 db를 주입하지 않는 경우를 대비해 SessionLocal로 임시 세션 생성 (MVP 전용)
        db_session = getattr(self, "db", None)
        temp_session = None
        client_override = getattr(self, "_client_override", None)
        if client_override:
            client = client_override
        else:
            if db_session is None:
                temp_session = SessionLocal()
                db_session = temp_session
            try:
                user_id_str = self.execution_context.get("user_id")
                client = None
                if user_id_str:
                    try:
                        user_id = uuid.UUID(user_id_str)
                        client = LLMService.get_client_for_user(
                            db_session, user_id=user_id, model_id=self.data.model_id
                        )
                    except Exception as e:
                        print(
                            f"[LLMNode] User context found but failed to get client: {e}. Fallback to legacy."
                        )

                if not client:
                    client = LLMService.get_client_with_any_credential(
                        db_session, model_id=self.data.model_id
                    )
            finally:
                # 임시 세션은 호출 후 정리
                if temp_session is not None:
                    temp_session.close()

        memory_summary = None
        try:
            memory_summary = self._build_memory_summary()
        except Exception as e:
            # 기억 모드 실패는 실행을 막지 않음 (비용만 스킵)
            print(f"[LLMNode] memory summary skipped: {e}")

        # STEP 2.5 Knowledge 검색 (RAG) ---------------------------------------
        knowledge_context = ""
        knowledge_metadata = []
        if self.data.knowledgeBases and len(self.data.knowledgeBases) > 0:
            try:
                # User Prompt를 검색 쿼리로 사용 (렌더링 후)
                rendered_user_prompt = self._render_prompt(
                    self.data.user_prompt, inputs
                )
                if rendered_user_prompt:
                    knowledge_context, knowledge_metadata = (
                        self._execute_knowledge_search(
                            query=rendered_user_prompt, db_session=db_session
                        )
                    )
            except Exception as e:
                print(f"[LLMNode] Knowledge search failed: {e}")

        # STEP 3. 프롬프트 빌드 ------------------------------------------------
        system_content = self._render_prompt(self.data.system_prompt, inputs)

        # Knowledge Context 주입 (System Prompt 최상단)
        if knowledge_context:
            rag_header = f"[참고 자료]\n아래 제공된 참고 자료를 바탕으로 답변하세요:\n\n{knowledge_context}\n\n---\n"
            system_content = rag_header + system_content

        messages = [
            {
                "role": "system",
                "content": system_content,
            },
            {
                "role": "user",
                "content": self._render_prompt(self.data.user_prompt, inputs),
            },
            {
                "role": "assistant",
                "content": self._render_prompt(self.data.assistant_prompt, inputs),
            },
        ]
        messages = [m for m in messages if m["content"]]  # 비어있는 메시지 제외
        if memory_summary:
            # 이전 실행 요약을 시스템 레이어에 앞단 삽입 (사용자 프롬프트 오염 방지)
            messages.insert(
                0,
                {
                    "role": "system",
                    "content": f"[이전 실행 요약]\n{memory_summary}",
                },
            )

        if not messages:
            raise ValueError(
                "프롬프트 렌더링 결과가 모두 비어있습니다. 입력 변수가 올바르게 전달되었는지 확인해주세요."
            )

        # STEP 4. LLM 호출 ----------------------------------------------------
        # 파라미터 전처리: stop 리스트에서 빈 문자열 제거
        llm_params = dict(self.data.parameters or {})
        if "stop" in llm_params and isinstance(llm_params["stop"], list):
            llm_params["stop"] = [s for s in llm_params["stop"] if s and s.strip()]
            if not llm_params["stop"]:
                del llm_params["stop"]

        used_model_id = self.data.model_id
        try:
            response = await client.invoke(messages=messages, **llm_params)
        except Exception as primary_error:
            fallback_model_id = self.data.fallback_model_id
            if not fallback_model_id:
                raise
            print(
                f"[LLMNode] Primary model failed: {primary_error}. "
                f"Trying fallback model: {fallback_model_id}"
            )
            fallback_client = None
            fallback_session = None
            try:
                if client_override:
                    fallback_client = client_override
                else:
                    session_for_fallback = db_session
                    if session_for_fallback is None:
                        fallback_session = SessionLocal()
                        session_for_fallback = fallback_session
                    user_id_str = self.execution_context.get("user_id")
                    if user_id_str:
                        try:
                            user_id = uuid.UUID(user_id_str)
                            fallback_client = LLMService.get_client_for_user(
                                session_for_fallback,
                                user_id=user_id,
                                model_id=fallback_model_id,
                            )
                        except Exception as e:
                            print(
                                f"[LLMNode] Fallback client load failed: {e}. "
                                "Fallback to legacy."
                            )

                    if not fallback_client:
                        fallback_client = LLMService.get_client_with_any_credential(
                            session_for_fallback, model_id=fallback_model_id
                        )
            finally:
                if fallback_session is not None:
                    fallback_session.close()

            try:
                response = await fallback_client.invoke(messages=messages, **llm_params)
            except Exception as fallback_error:
                raise fallback_error from primary_error
            used_model_id = fallback_model_id

        # OpenAI 응답 포맷에서 텍스트/usage 추출 (missing 시 안전하게 빈 값)
        text = ""
        try:
            text = (
                response.get("choices", [{}])[0].get("message", {}).get("content", "")
            )
        except Exception:
            text = ""
        usage = response.get("usage", {}) if isinstance(response, dict) else {}

        # STEP 5. 결과 포맷팅 --------------------------------------------------
        cost = 0.0
        if usage:
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            try:
                # DB 세션이 있으면 비용 계산
                if db_session:
                    cost = LLMService.calculate_cost(
                        db_session, used_model_id, prompt_tokens, completion_tokens
                    )

                    # [NEW] Usage 로깅 저장
                    user_id_str = self.execution_context.get("user_id")
                    workflow_run_id_str = self.execution_context.get("workflow_run_id")

                    if user_id_str:
                        try:
                            # workflow_run_id는 engine에서 string으로 넘겨준다고 가정 (execute_stream 참조)
                            wf_run_uuid = (
                                uuid.UUID(workflow_run_id_str)
                                if workflow_run_id_str
                                else None
                            )

                            LLMService.log_usage(
                                db=db_session,
                                user_id=uuid.UUID(user_id_str),
                                model_id=used_model_id,
                                usage=usage,
                                cost=cost,
                                workflow_run_id=wf_run_uuid,
                                node_id=self.id,
                            )
                        except Exception as log_err:
                            print(f"[LLMNode] Failed to save usage log: {log_err}")

            except Exception as e:
                print(f"[LLMNode] Cost calculation/logging failed: {e}")

        return {
            "text": text,
            "usage": usage,
            "model": used_model_id,
            "cost": cost,
            "metadata": {
                "knowledge_search": knowledge_metadata if knowledge_metadata else None
            },
        }

    def _render_prompt(self, template: Optional[str], inputs: Dict[str, Any]) -> str:
        """
        프롬프트 템플릿을 jinja2로 렌더링합니다.
        Template 노드와 동일한 방식으로 referenced_variables의 value_selector를 사용하여
        이전 노드의 output에서 값을 추출합니다.
        """
        if not template:
            return ""

        context: Dict[str, Any] = {}

        # referenced_variables에서 각 변수의 값을 추출
        for variable in self.data.referenced_variables:
            var_name = variable.name
            selector = variable.value_selector

            # 필수값 체크
            if not var_name or not selector or len(selector) < 1:
                context[var_name] = ""
                continue

            target_node_id = selector[0]

            # 입력 데이터에서 해당 노드의 결과 찾기
            source_data = inputs.get(target_node_id)

            if source_data is None:
                context[var_name] = ""
                continue

            # 값 추출 (selector가 2개 이상일 경우 중첩된 값 탐색)
            # 예: ["start-1", "username"] -> inputs["start-1"]["username"]
            if len(selector) > 1:
                value = _get_nested_value(source_data, selector[1:])
                context[var_name] = value if value is not None else ""
            else:
                # selector가 노드 ID만 있는 경우
                context[var_name] = source_data

        # Jinja2 템플릿 렌더링
        try:
            return _jinja_env.from_string(template).render(**context)
        except Exception as e:
            raise ValueError(f"프롬프트 렌더링 실패: {e}")

    def _build_memory_summary(self) -> Optional[str]:
        """
        최근 워크플로우 실행에서 LLM 노드 입출력을 요약해 시스템 프롬프트에 넣습니다.
        - 키가 없거나 히스토리가 없으면 조용히 None 반환
        - 요약 실패 시 워크플로우 실행은 그대로 진행
        """
        if not self.execution_context.get("memory_mode"):
            return None

        try:
            workflow_id = uuid.UUID(str(self.execution_context.get("workflow_id")))
            user_id = uuid.UUID(str(self.execution_context.get("user_id")))
        except Exception:
            return None

        session = SessionLocal()
        try:
            current_run_id = self.execution_context.get("workflow_run_id")
            # 최근 실행 N건 조회 (본 실행 제외)
            run_query = (
                session.query(WorkflowRun)
                .filter(
                    WorkflowRun.workflow_id == workflow_id,
                    WorkflowRun.user_id == user_id,
                    WorkflowRun.status == RunStatus.SUCCESS,
                )
                .order_by(WorkflowRun.started_at.desc())
                .limit(MEMORY_RUN_LIMIT + 1)
            )
            runs = run_query.all()
            if current_run_id:
                runs = [r for r in runs if str(r.id) != str(current_run_id)]
            runs = runs[:MEMORY_RUN_LIMIT]
            run_ids = [r.id for r in runs]
            if not run_ids:
                return None

            node_runs = (
                session.query(WorkflowNodeRun)
                .filter(
                    WorkflowNodeRun.workflow_run_id.in_(run_ids),
                    WorkflowNodeRun.node_type == "llmNode",
                )
                .order_by(WorkflowNodeRun.started_at.desc())
                .limit(MEMORY_RUN_LIMIT)
                .all()
            )
            if not node_runs:
                return None

            history_lines = []
            for idx, nr in enumerate(node_runs):
                history_lines.append(
                    f"- #{idx + 1} [{nr.node_id}] input={self._shorten(nr.inputs)} | output={self._shorten(nr.outputs)}"
                )

            summary_model_id = self._pick_summary_model(session, self.data.model_id)
            summary_client = LLMService.get_client_for_user(
                session,
                user_id=user_id,
                model_id=summary_model_id,
            )
            summary_messages = [
                {
                    "role": "system",
                    "content": "아래는 이전 실행의 LLM 입력/출력 기록입니다. 핵심 사실만 3~5줄로 짧게 요약하고, 반복 설명을 줄일 수 있게 맥락을 남겨주세요.",
                },
                {"role": "user", "content": "\n".join(history_lines)},
            ]
            summary_response = summary_client.invoke(
                messages=summary_messages,
                temperature=0.2,
                max_tokens=512,
            )
            try:
                return (
                    summary_response.get("choices", [{}])[0]
                    .get("message", {})
                    .get("content", "")
                ) or None
            except Exception:
                return None
        finally:
            session.close()

    def _shorten(self, payload: Any, limit: int = 360) -> str:
        """LLM 히스토리 문자열을 과하지 않게 자르는 헬퍼 (한국어 포함)"""
        if payload is None:
            return ""
        try:
            if isinstance(payload, str):
                text = payload
            else:
                text = json.dumps(payload, ensure_ascii=False)
        except Exception:
            text = str(payload)
        if len(text) > limit:
            return text[:limit] + "..."
        return text

    def _pick_summary_model(self, session, fallback_model: str) -> str:
        """요약 전용으로 가성비 좋은 모델을 선택 (사용자 키가 있는 같은 프로바이더 우선)"""
        provider_name = None
        try:
            base_model = (
                session.query(LLMModel)
                .filter(LLMModel.model_id_for_api_call == fallback_model)
                .first()
            )
            if base_model and base_model.provider:
                provider_name = base_model.provider.name.lower()
        except Exception:
            provider_name = None

        candidates = SUMMARY_MODEL_PREFS.get(provider_name, [])
        for mid in candidates:
            exists = (
                session.query(LLMModel.id)
                .filter(LLMModel.model_id_for_api_call == mid)
                .first()
            )
            if exists:
                return mid
        return fallback_model
        return fallback_model

    def _execute_knowledge_search(
        self, query: str, db_session
    ) -> tuple[str, List[Dict[str, Any]]]:
        """
        연결된 지식 베이스에서 문서를 검색합니다.
        KnowledgeNode 로직을 재사용.
        """
        user_id_str = self.execution_context.get("user_id")
        user_id = None
        if user_id_str:
            try:
                user_id = uuid.UUID(user_id_str)
            except Exception:
                pass

        if not user_id:
            return "", []

        retrieval = RetrievalService(db_session, user_id)

        kb_ids = [kb.id for kb in self.data.knowledgeBases if kb.id]
        top_k = self.data.topK or 3
        threshold = self.data.scoreThreshold or 0.5

        all_chunks: List[tuple[str, ChunkPreview]] = []

        for kb_id in kb_ids:
            chunks = retrieval.search_documents(
                query,
                knowledge_base_id=kb_id,
                top_k=top_k,
                threshold=threshold,
            )
            for chunk in chunks:
                all_chunks.append((kb_id, chunk))

        # 유사도 순 정렬
        sorted_chunks = sorted(
            all_chunks,
            key=lambda item: getattr(item[1], "similarity_score", 0),
            reverse=True,
        )
        top_chunks = sorted_chunks[:top_k] if top_k else sorted_chunks

        if not top_chunks:
            return "", []

        # 컨텍스트 조립
        context_parts = []
        metadata_list = []

        for kb_id, chunk in top_chunks:
            # 예: [파일명] 내용...
            context_parts.append(f"[파일: {chunk.filename}]\n{chunk.content}")

            # 메타데이터 직렬화
            meta = chunk.dict()
            for key, value in list(meta.items()):
                if isinstance(value, uuid.UUID):
                    meta[key] = str(value)
            meta["knowledge_base_id"] = str(kb_id)
            metadata_list.append(meta)

        combined_context = "\n\n".join(context_parts)
        return combined_context, metadata_list
