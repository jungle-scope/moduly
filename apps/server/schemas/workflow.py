from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class Position(BaseModel):
    x: float
    y: float


class NodeSchema(BaseModel):
    id: str
    type: str
    position: Position
    data: Dict[str, Any]

    class Config:
        extra = "allow"


class EdgeSchema(BaseModel):
    id: str
    source: str
    target: str

    class Config:
        extra = "allow"


class ViewportSchema(BaseModel):
    x: float
    y: float
    zoom: float


class WorkflowDraftRequest(BaseModel):
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]
    viewport: Optional[ViewportSchema] = None
    features: Optional[Dict[str, Any]] = None


class WorkflowCreateRequest(BaseModel):
    """새 워크플로우 생성 요청"""

    app_id: str
    name: str
    description: Optional[str] = None


class WorkflowResponse(BaseModel):
    """워크플로우 응답"""

    id: str
    app_id: str
    marked_name: Optional[str]
    marked_comment: Optional[str]
    created_at: str
    updated_at: str
