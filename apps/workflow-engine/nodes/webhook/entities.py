"""Webhook Node Entities"""

from typing import List

from pydantic import BaseModel, Field

from apps.workflow_engine.nodes.base.entities import BaseNodeData


class VariableMapping(BaseModel):
    """Webhook Payload의 JSON Path와 워크플로우 변수를 매핑"""

    variable_name: str = Field(..., description="워크플로우 내부에서 사용할 변수명")
    json_path: str = Field(
        ..., description="Webhook Payload의 JSON 경로 (예: issue.key)"
    )


class WebhookTriggerNodeData(BaseNodeData):
    """
    Webhook Trigger Node 설정
    """

    provider: str = Field("custom", description="Provider 프리셋 (jira, custom 등)")
    variable_mappings: List[VariableMapping] = Field(
        default_factory=list, description="Payload에서 추출할 변수 매핑"
    )
