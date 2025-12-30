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
        """
        사용자 입력을 다음 노드로 전달합니다.
        
        [중요] 변수 ID 매핑이 필요한 이유:
        - 프론트엔드의 Answer/Condition 노드는 value_selector에 변수 ID를 저장합니다.
          예: ["start-xxx", "45af2b51-d499-4a8d-a9bd-f18fdc9b942b"]
        - 하지만 사용자 입력은 변수 이름을 키로 사용합니다.
          예: {"updated": 100}
        - 따라서 ID로도 값을 조회할 수 있도록 매핑을 추가해야 합니다.
          결과: {"updated": 100, "45af2b51-...": 100}
        
        이 매핑이 없으면 변수 이름이 변경되었을 때 참조가 깨집니다.
        ID 기반 참조를 사용하면 변수 이름을 변경해도 정상 동작합니다.
        """
        result = dict(inputs)
        
        # 변수 이름 -> ID 매핑 추가 (ID 기반 조회 지원)
        for var in self.data.variables:
            if var.name in inputs:
                result[var.id] = inputs[var.name]
        
        return result
