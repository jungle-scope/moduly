from typing import List, Optional

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

    def validate(self) -> None:
        # 모델은 필수
        if not self.model_id or not self.model_id.strip():
            raise ValueError("모델을 선택하세요.")
        # Provider is now inferred from model_id via LLMService

        prompts = [self.system_prompt, self.user_prompt, self.assistant_prompt]
        if all(not p for p in prompts):
            raise ValueError("system/user/assistant 프롬프트 중 최소 1개는 필요합니다.")

        # referenced_variables 검증 (각 변수에 name과 value_selector가 있는지)
        for var in self.referenced_variables:
            if not var.name or not var.name.strip():
                raise ValueError("변수명이 비어있습니다.")
            if not var.value_selector or len(var.value_selector) < 1:
                raise ValueError(f"변수 '{var.name}'의 value_selector가 비어있습니다.")

        if self.context_variable is not None:
            stripped_context = self.context_variable.strip()
            if not stripped_context:
                self.context_variable = None
            else:
                self.context_variable = stripped_context
