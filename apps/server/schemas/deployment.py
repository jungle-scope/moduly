from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from db.models.workflow_deployment import DeploymentType


class DeploymentBase(BaseModel):
    type: DeploymentType = DeploymentType.API
    url_slug: Optional[str] = Field(
        None, max_length=255, pattern=r"^[a-z0-9-]+$"
    )  # 소문자, 숫자, 하이픈만 허용
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = {}
    is_active: bool = True


class DeploymentCreate(DeploymentBase):
    workflow_id: UUID  # String ID -> UUID
    # TODO: 프론트엔드에서 localStorage에 저장된 스냅샷을 보내주는 방식으로 변경
    # 현재는 백엔드에서 DB의 draft를 읽어서 저장함
    graph_snapshot: Optional[Dict[str, Any]] = None
    auth_secret: Optional[str] = None  # 생성 시에만 입력 가능


class DeploymentResponse(DeploymentBase):
    id: UUID
    workflow_id: UUID
    version: int
    auth_secret: Optional[str] = None  # 보안상 일부만 보여주거나 숨길 수 있음
    created_by: UUID
    created_at: datetime
    graph_snapshot: Dict[str, Any]
    input_schema: Optional[Dict[str, Any]] = None  # StartNode 입력 스키마
    output_schema: Optional[Dict[str, Any]] = None  # AnswerNode 출력 스키마

    class Config:
        from_attributes = True


class DeploymentInfoResponse(BaseModel):
    """공개 배포 정보 응답 (인증 불필요)"""

    url_slug: str
    version: int
    description: Optional[str] = None
    type: str
    input_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
