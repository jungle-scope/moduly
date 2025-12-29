"""코드 노드 엔터티 - 코드 실행 노드 데이터 모델"""

from typing import List

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class CodeNodeInput(BaseModel):
    """코드 노드 입력 변수 매핑"""

    name: str = Field(..., description="코드 내에서 사용할 변수 이름")
    source: str = Field(..., description="소스 경로 (예: 'Start.query')")


class CodeNodeData(BaseNodeData):
    """코드 실행 노드 데이터 모델"""

    code: str = Field(
        "def main(inputs):\n    return {}", description="실행할 파이썬 코드"
    )
    inputs: List[CodeNodeInput] = Field(
        default_factory=list, description="입력 변수 매핑"
    )
    timeout: int = Field(10, description="실행 타임아웃 (초)")
