from typing import List

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class TemplateVariable(BaseModel):
    """
    템플릿 내에서 사용될 변수 정의
    """

    name: str = Field(..., description="템플릿 변수명 (예: user_name)")
    value_selector: List[str] = Field(
        ..., description="값을 가져올 경로 [node_id, variable_key]"
    )


class TemplateNodeData(BaseNodeData):
    """
    Template Node의 데이터 구조
    """

    template: str = Field("", description="Jinja2 템플릿 문자열")
    variables: List[TemplateVariable] = Field(
        default_factory=list, description="템플릿에 사용할 변수 목록"
    )
