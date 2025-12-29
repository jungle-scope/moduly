"""Condition Node 관련 엔티티 정의"""

from enum import Enum
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from workflow.core.entities import BaseNodeData


class ConditionOperator(str, Enum):
    """조건 비교 연산자"""

    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_THAN_OR_EQUALS = "greater_than_or_equals"
    LESS_THAN_OR_EQUALS = "less_than_or_equals"


class Condition(BaseModel):
    """단일 조건 정의"""

    id: str
    variable_selector: List[str] = Field(
        ..., description="비교 대상 변수 경로 [node_id, output_key, ...]"
    )
    operator: ConditionOperator = Field(..., description="비교 연산자")
    value: Optional[Any] = Field(None, description="비교할 값 (연산자에 따라 필요)")


class ConditionNodeData(BaseNodeData):
    """Condition Node 전용 데이터"""

    conditions: List[Condition] = Field(
        default_factory=list, description="평가할 조건 목록"
    )
    logical_operator: Literal["and", "or"] = Field(
        "and", description="여러 조건 결합 방식"
    )
