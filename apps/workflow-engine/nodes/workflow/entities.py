from typing import List

from pydantic import BaseModel, Field

from apps.workflow_engine.nodes.base.entities import BaseNodeData


class WorkflowNodeInput(BaseModel):
    name: str = Field(..., description="타겟 변수명")
    value_selector: List[str] = Field(default=[], description="셀렉터 [node_id, key]")


class WorkflowNodeData(BaseNodeData):
    workflowId: str = Field(..., description="타겟 워크플로우 ID")
    appId: str = Field(..., description="타겟 앱 ID")
    inputs: List[WorkflowNodeInput] = Field(default=[], description="입력 매핑 목록")
    # 지금은 사용이 안되는 것 같은데 혹시 모를 나중을 위해서 남겨 놓습니다..
    outputs: List[str] = Field(
        default=[], description="output_schema에서 예상되는 출력 변수명 목록"
    )
