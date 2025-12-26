from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class NodeStatus(str, Enum):
    """노드 실행 상태"""

    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class EdgeStatus(str, Enum):
    """엣지 실행 상태"""

    IDLE = "idle"
    SKIPPED = "skipped"
    EXECUTED = "executed"


class BaseNodeData(BaseModel):
    """
    모든 노드가 공통으로 가지는 데이터 구조입니다.
    가볍게 시작합니다.
    """

    title: str = Field(..., description="노드의 이름")
    description: Optional[str] = Field(None, description="노드 설명")

    # 노드 설정값 (사용자가 입력한 값들)
    # 복잡한 타입 정의 대신 유연한 Dict로 시작합니다.
    parameters: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        arbitrary_types_allowed = True
