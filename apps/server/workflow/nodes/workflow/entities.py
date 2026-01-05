from typing import List

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class WorkflowNodeInput(BaseModel):
    name: str = Field(..., description="Target variable name")
    value_selector: List[str] = Field(default=[], description="Selector [node_id, key]")


class WorkflowNodeData(BaseNodeData):
    workflowId: str = Field(..., description="Target workflow ID")
    appId: str = Field(..., description="Target App ID")
    inputs: List[WorkflowNodeInput] = Field(default=[], description="Input mappings")
    outputs: List[str] = Field(
        default=[], description="Expected output variable names from output_schema"
    )
