from typing import List, Optional

from pydantic import Field

from workflow.nodes.base.entities import BaseNodeData


class FileExtractionNodeData(BaseNodeData):
    """
    FileExtraction 노드 설정 정의

    파일 경로를 받아서 PDF 내용을 추출하는 노드입니다.
    """

    file_path_variable: Optional[List[str]] = Field(
        None,
        description="파일 경로를 가져올 변수 선택 (value_selector 형식: [node_id, variable_key])",
    )
