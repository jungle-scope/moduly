import re
from typing import List, Optional

from pydantic import Field

from ...core.entities import BaseNodeData


class LLMNodeData(BaseNodeData):
    """
    개요: LLM 노드에서 사용할 설정/입력값 정의.
    - 필드 정의
    - validation 메서드 정의 (인스턴스)
    """

    provider: str
    model_id: str
    system_prompt: Optional[str] = None
    user_prompt: Optional[str] = None
    assistant_prompt: Optional[str] = None
    referenced_variables: List[str] = Field(default_factory=list)
    context_variable: Optional[str] = None
    # 이전 노드의 output은 어떻게 받을지?

    def validate(self) -> None:
        # 모델/프로바이더는 필수
        if not self.model_id or not self.model_id.strip():
            raise ValueError("모델을 선택하세요.")
        if not self.provider or not self.provider.strip():
            raise ValueError("provider를 선택하세요.")

        prompts = [self.system_prompt, self.user_prompt, self.assistant_prompt]
        if all(not p for p in prompts):
            raise ValueError("system/user/assistant 프롬프트 중 최소 1개는 필요합니다.")

        # referenced_variables/context_variable은 선택 입력이지만, 제공 시 빈 문자열은 불가
        invalid_vars = [v for v in self.referenced_variables if not v or not v.strip()]
        if invalid_vars:
            raise ValueError("참조 변수 이름이 비어있습니다.")

        if self.context_variable is not None and not self.context_variable.strip():
            raise ValueError("context_variable 이름이 비어있습니다.")

        # Jinja2 {{var}} 플레이스홀더 탐지 (추후 이전 노드 값 검증에 활용)
        jinja_vars = []
        for prompt in prompts:
            if prompt:
                jinja_vars.extend(re.findall(r"{{\s*([^{}]+?)\s*}}", prompt))
        # TODO: inputs 스펙 확정 후, jinja_vars/referenced_variables가 이전 노드에 존재하는지 검증.
