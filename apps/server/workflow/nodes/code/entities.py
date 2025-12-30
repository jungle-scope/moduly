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
        "def main(inputs):\n"
        "    # 입력변수를 inputs['변수명']의 형태로 할당\n"
        "    \n"
        "    val1 = inputs['변수명1']\n"
        "    val2 = inputs['변수명2']\n"
        "    \n"
        "    total = val1 + val2\n"
        "    \n"
        "    # 반드시 딕셔너리 형태로 결과 반환\n"
        "    return {\n"
        '        "result": total\n'
        "    }",
        description="실행할 파이썬 코드",
    )
    inputs: List[CodeNodeInput] = Field(
        default_factory=list, description="입력 변수 매핑"
    )
    timeout: int = Field(10, description="실행 타임아웃 (초)")
