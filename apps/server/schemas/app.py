from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AppCreateRequest(BaseModel):
    """앱 생성 요청 스키마"""

    name: str
    description: Optional[str] = None
    icon: str
    icon_background: str


class AppResponse(BaseModel):
    """앱 응답 스키마"""

    id: UUID
    name: str
    description: Optional[str]
    icon: str
    icon_background: str
    workflow_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
