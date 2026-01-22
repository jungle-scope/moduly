from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from apps.workflow_engine.workflow.nodes.base.entities import BaseNodeData
from apps.workflow_engine.workflow.nodes.base.node import Node


class SelectOption(BaseModel):
    """Select 타입 변수의 옵션"""

    label: str
    value: str


class WorkflowVariable(BaseModel):
    """워크플로우 시작 시 사용자로부터 입력받을 변수 정의"""

    id: str
    name: str = Field(..., description="변수명 (코드용, 영문/숫자/언더스코어)")
    label: str = Field(..., description="표시명 (사용자에게 보여질 이름)")
    type: Literal["text", "number", "paragraph", "checkbox", "select", "file"] = Field(
        ..., description="변수 타입"
    )
    required: bool = Field(False, description="필수 입력 여부")
    max_length: Optional[int] = Field(None, description="최대 길이 (text, paragraph)")


class StartNodeData(BaseNodeData):
    """
    Start Node만의 특별한 설정이 있다면 여기에 정의합니다.
    (예: 트리거 방식 등)
    """

    trigger_type: str = Field(
        "manual", description="실행 트리거 방식 (manual, webhook 등)"
    )
    variables: List[WorkflowVariable] = Field(
        default_factory=list, description="워크플로우 시작 시 입력받을 변수들"
    )


class StartNode(Node[StartNodeData]):
    """
    워크플로우의 시작점입니다.
    사용자 입력을 그대로 다음 노드로 전달하는 역할을 합니다.
    """

    node_type = "startNode"

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        사용자 입력을 다음 노드로 전달합니다.

        기능:
        1. 변수 타입 자동 변환 (예: "11" -> 11)
        2. 변수 이름 및 ID 매핑 (ID 기반 참조 지원)
        """
        result = {}

        # 타입 변환 및 ID 매핑
        for var in self.data.variables:
            if var.name not in inputs:
                continue

            raw_val = inputs[var.name]
            converted_val = raw_val

            # Number 타입 변환
            if var.type == "number":
                try:
                    # 정수/실수 판단하여 변환
                    s_val = str(raw_val)
                    if "." in s_val:
                        converted_val = float(s_val)
                    else:
                        converted_val = int(s_val)
                except (ValueError, TypeError):
                    # 변환 실패 시 명시적 에러 발생
                    raise ValueError(
                        f"변수 '{var.name}'의 값 '{raw_val}'은(는) 유효한 숫자(Number)가 아닙니다."
                    )

            # TODO: 필요 시 Boolean 등 추가

            result[var.name] = converted_val
            result[var.id] = converted_val

        return result
