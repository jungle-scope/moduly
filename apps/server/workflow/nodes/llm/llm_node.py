from typing import Any, Dict, Optional

from jinja2 import Environment

from db.session import SessionLocal  # 임시 세션 생성용 (TODO: 엔진 주입으로 교체)
from services.llm_service import LLMService

from ..base.node import Node
from .entities import LLMNodeData

_jinja_env = Environment(autoescape=False)


class LLMNode(Node[LLMNodeData]):
    """
    정의: 입력/프롬프트를 조합해 LLM을 호출하고 답변을 생성하는 노드.

    제약사항(요구사항 정리):
    - 프롬프트 안에 최소 하나 이상의 텍스트 또는 참조 변수가 있어야 함.
    - 모델 선택 시: 등록된 API key가 있는 모델만 허용.
    - 변수 참조: 이전 노드에서 생성된 변수만 사용 가능.
    - 상세 기능: 모델 선택, 시스템/유저/어시스턴트 프롬프트, 컨텍스트(RAG) 전달.
    """

    node_type = "llm"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        LLM 노드의 실제 실행 로직 구현

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
        client_override = getattr(self, "_client_override", None)
        if client_override:
            client = client_override
        else:
            db_session = getattr(self, "db", None)
            temp_session = None
            if db_session is None:
                temp_session = SessionLocal()
                db_session = temp_session
            try:
                client = LLMService.get_any_provider_client(db_session)
            finally:
                # 임시 세션은 호출 후 정리
                if temp_session is not None:
                    temp_session.close()

        # STEP 3. 프롬프트 빌드 ------------------------------------------------
        # TODO: _render_prompt 구현 후, inputs + referenced/context 변수로 템플릿을 렌더링합니다.
        # - 템플릿에 있는 {{var}} / context placeholder 등을 inputs로 치환
        # - 비어있는 메시지는 제외해 LLM으로 전달
        messages = [
            {
                "role": "system",
                "content": self._render_prompt(self.data.system_prompt, inputs),
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

        # STEP 4. LLM 호출 ----------------------------------------------------
        # TODO: 준비된 클라이언트로 호출
        response = client.invoke(messages=messages, **(self.data.parameters or {}))

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
        # TODO: downstream에서 사용할 출력 형태 확정 후 -> 수정 필요하면 수정하겠음
        return {"text": text, "usage": usage, "model": self.data.model_id}

    def _render_prompt(self, template: Optional[str], inputs: Dict[str, Any]) -> str:
        """
        프롬프트 템플릿을 jinja2로 렌더링합니다.
        - referenced_variables에 명시된 변수만 컨텍스트로 사용
        - context_variable 사용 방식은 확정 전이라 TODO로 남김
        """
        if not template:
            return ""

        prompt_vars: Dict[str, Any] = {}

        # 명시된 변수만 추가, 없으면 빈 문자열로 채움
        for var in self.data.referenced_variables:
            prompt_vars[var] = inputs.get(var, "")
        # TODO: context_variable을 어떻게 활용할지 확정 후 처리 로직 보완
        # if self.data.context_variable:
        #     prompt_vars[self.data.context_variable] = inputs.get(
        #         self.data.context_variable, ""
        #     )

        try:
            return _jinja_env.from_string(template).render(**prompt_vars)
        except Exception as e:
            raise ValueError(f"프롬프트 렌더링 실패: {e}")
