from typing import List

from pydantic import BaseModel, Field

from apps.workflow_engine.workflow.nodes.base.entities import BaseNodeData


class VariableExtractionMapping(BaseModel):
    name: str = Field(..., description="추출된 값을 저장할 변수명")
    json_path: str = Field(..., description="JSON 경로 (예: data.items[0].id)")


class VariableExtractionNodeData(BaseNodeData):
    source_selector: List[str] = Field(
        default_factory=list,
        description="원본 JSON 선택자 (node_id, output_key)",
    )
    mappings: List[VariableExtractionMapping] = Field(
        default_factory=list, description="추출할 변수 매핑 목록"
    )
