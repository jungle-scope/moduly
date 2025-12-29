from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData
from workflow.nodes.base.node import Node


class SelectOption(BaseModel):
    """Select 타입 변수의 옵션"""

    label: str
    value: str


class WorkflowVariable(BaseModel):
    """워크플로우 시작 시 사용자로부터 입력받을 변수 정의"""

    id: str
    name: str = Field(..., description="변수명 (코드용, 영문/숫자/언더스코어)")
    label: str = Field(..., description="표시명 (사용자에게 보여질 이름)")
    type: Literal["text", "number", "paragraph", "checkbox", "select"] = Field(
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

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        # Start Node는 복잡한 로직 없이
        # 들어온 입력을 그대로 출력으로 내보냅니다.
        return inputs
