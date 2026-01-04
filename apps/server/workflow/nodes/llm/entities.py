from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class LLMVariable(BaseModel):
    """
    LLM 프롬프트에서 사용될 변수 정의 (Template 노드와 동일한 구조)
    """

    name: str = Field(..., description="프롬프트 변수명 (예: username)")
    value_selector: List[str] = Field(
        ..., description="값을 가져올 경로 [node_id, variable_key]"
    )


class LLMNodeData(BaseNodeData):
    """
    개요: LLM 노드에서 사용할 설정/입력값 정의.
    - 필드 정의
    - validation 메서드 정의 (인스턴스)
    """

    provider: Optional[str] = None
    model_id: str
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None
    assistant_prompt: Optional[str] = None
    referenced_variables: List[LLMVariable] = Field(default_factory=list)
    context_variable: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict, description="LLM API 파라미터 (temperature, top_p, max_tokens 등)")

    def validate(self) -> None:
        # 모델은 필수
        if not self.model_id or not self.model_id.strip():
            raise ValueError("모델을 선택하세요.")
        # Provider is now inferred from model_id via LLMService

        prompts = [self.system_prompt, self.user_prompt, self.assistant_prompt]
        if all(not p for p in prompts):
            raise ValueError("system/user/assistant 프롬프트 중 최소 1개는 필요합니다.")

        # referenced_variables 정리: 불완전한 변수(이름/selector 없음)는 무시
        cleaned_vars = []
        for var in self.referenced_variables:
            name = (var.name or "").strip()
            selector = var.value_selector or []
            # 이름과 selector가 모두 비어있으면 무시
            if not name and (not selector or len(selector) < 2):
                continue
            # 이름은 있지만 selector가 불완전하면 무시
            if name and (not selector or len(selector) < 2):
                continue
            cleaned_vars.append(var)
        self.referenced_variables = cleaned_vars

        if self.context_variable is not None:
            stripped_context = self.context_variable.strip()
            if not stripped_context:
                self.context_variable = None
            else:
                self.context_variable = stripped_context
