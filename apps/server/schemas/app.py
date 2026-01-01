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
    is_public: bool = False


class AppUpdateRequest(BaseModel):
    """앱 수정 요청 스키마"""

    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    icon_background: Optional[str] = None
    is_public: Optional[bool] = None


class AppResponse(BaseModel):
    """앱 응답 스키마"""

    id: UUID
    name: str
    description: Optional[str]
    icon: str
    icon_background: str
    is_public: bool
    workflow_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
