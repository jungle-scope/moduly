from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class AppIcon(BaseModel):
    type: str
    content: str
    background_color: str


class AppCreateRequest(BaseModel):
    """앱 생성 요청 스키마"""

    name: str
    description: Optional[str] = None
    icon: AppIcon = AppIcon(type="emoji", content="📚", background_color="#D1E9FF")
    is_market: bool = False


class AppUpdateRequest(BaseModel):
    """앱 수정 요청 스키마"""

    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[AppIcon] = None
    is_market: Optional[bool] = None


class AppResponse(BaseModel):
    """앱 응답 스키마"""

    id: UUID
    name: str
    description: Optional[str]
    icon: AppIcon
    workflow_id: Optional[UUID] = None  # App의 작업실 Workflow
    url_slug: Optional[str] = None  # 첫 배포 시 생성
    auth_secret: Optional[str] = None  # Webhook 인증용 시크릿
    is_market: bool
    forked_from: Optional[UUID] = None
    active_deployment_id: Optional[UUID] = None
    active_deployment_type: Optional[str] = None
    active_deployment_is_active: Optional[bool] = None  # 활성 배포의 is_active 상태
    owner_name: Optional[str] = None  # UI 표시용 (생성자 이름)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
