"""Condition Node 관련 엔티티 정의"""

from enum import Enum
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


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


class ConditionCase(BaseModel):
    """단일 분기 케이스 - 여러 조건을 가질 수 있음"""

    id: str = Field(..., description="케이스 고유 ID (핸들 ID로 사용)")
    case_name: str = Field("", description="사용자가 지정하는 분기 이름")
    conditions: List[Condition] = Field(
        default_factory=list, description="이 케이스의 조건 목록"
    )
    logical_operator: Literal["and", "or"] = Field(
        "and", description="조건 결합 방식"
    )


class ConditionNodeData(BaseNodeData):
    """Condition Node 전용 데이터 - Multi-Branch 지원"""

    # 새로운 multi-branch 구조
    cases: List[ConditionCase] = Field(
        default_factory=list, description="분기 케이스 목록 (순차 평가)"
    )

    # 하위 호환성을 위한 레거시 필드 (deprecated)
    conditions: Optional[List[Condition]] = Field(
        None, description="[DEPRECATED] 기존 단일 조건 그룹"
    )
    logical_operator: Optional[Literal["and", "or"]] = Field(
        None, description="[DEPRECATED] 기존 논리 연산자"
    )
