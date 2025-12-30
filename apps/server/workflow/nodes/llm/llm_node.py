from typing import Any, Dict, List, Optional

from jinja2 import Environment

from db.session import SessionLocal  # 임시 세션 생성용 (TODO: 엔진 주입으로 교체)
from services.llm_service import LLMService

from ..base.node import Node
from .entities import LLMNodeData

_jinja_env = Environment(autoescape=False)


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
        return {"text": text, "usage": usage, "model": self.data.model_id}

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
