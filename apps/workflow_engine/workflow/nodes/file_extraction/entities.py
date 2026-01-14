from typing import List

from pydantic import BaseModel, Field

from apps.workflow_engine.workflow.nodes.base.entities import BaseNodeData


class FileExtractionVariable(BaseModel):
    """변수 선택자 (value_selector)"""

    name: str = Field(..., description="변수 이름 (별칭)")
    value_selector: List[str] = Field(
        ..., description="값 선택자: [node_id, output_key]"
    )


class FileExtractionNodeData(BaseNodeData):
    """
    FileExtraction 노드 설정 정의

    파일 경로를 받아서 문서 내용을 추출하는 노드입니다.
    """

    referenced_variables: List[FileExtractionVariable] = Field(
        default_factory=list,
        description="파일 경로를 가져올 변수 목록",
    )
