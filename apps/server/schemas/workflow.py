from typing import List, Dict, Any, Optional
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
