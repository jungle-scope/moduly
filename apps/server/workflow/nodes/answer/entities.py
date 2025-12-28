from typing import List

from pydantic import BaseModel, Field

from workflow.core.entities import BaseNodeData


class AnswerNodeOutput(BaseModel):
    """
    Answer Node의 각 출력 항목을 정의합니다.
    BaseNodeData가 아닌 BaseModel을 상속 (title 필수 문제 해결)
    """
    variable: str = Field(..., description="출력할 변수명 (Key)")
    value_selector: List[str] = Field(..., description="값을 가져올 위치 [node_id, variable_key]")


class AnswerNodeData(BaseNodeData):
    """
    Answer Node의 데이터 구조입니다.
    여러 개의 출력을 설정할 수 있습니다.
    """
    outputs: List[AnswerNodeOutput] = Field(default_factory=list, description="출력 변수 설정 목록")
