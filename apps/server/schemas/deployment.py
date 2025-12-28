from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from db.models.workflow_deployment import DeploymentType


class DeploymentBase(BaseModel):
    version: int
    type: DeploymentType = DeploymentType.API
    url_slug: Optional[str] = Field(
        None, max_length=255, pattern=r"^[a-z0-9-]+$"
    )  # 소문자, 숫자, 하이픈만 허용
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = {}
    is_active: bool = True


class DeploymentCreate(DeploymentBase):
    workflow_id: str  # String ID
    # TODO: 프론트엔드에서 localStorage에 저장된 스냅샷을 보내주는 방식으로 변경
    # 현재는 백엔드에서 DB의 draft를 읽어서 저장함
    graph_snapshot: Optional[Dict[str, Any]] = None
    auth_secret: Optional[str] = None  # 생성 시에만 입력 가능


class DeploymentResponse(DeploymentBase):
    id: UUID
    workflow_id: str
    auth_secret: Optional[str] = None  # 보안상 일부만 보여주거나 숨길 수 있음
    created_by: UUID
    created_at: datetime
    graph_snapshot: Dict[str, Any]

    class Config:
        from_attributes = True
