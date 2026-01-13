"""Schedule Trigger Node Entities"""

from pydantic import Field, field_validator

from apps.workflow_engine.nodes.base.entities import BaseNodeData


class ScheduleTriggerNodeData(BaseNodeData):
    """
    Schedule Trigger Node 설정

    특정 시간에 워크플로우를 자동으로 실행하는 노드의 데이터 모델
    """

    cron_expression: str = Field(
        ..., description="Cron 표현식 (예: '0 9 * * *' = 매일 오전 9시)"
    )
    timezone: str = Field("UTC", description="타임존 (예: 'Asia/Seoul', 'UTC')")

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        """Cron 표현식 기본 유효성 검증"""
        parts = v.strip().split()
        if len(parts) != 5:
            raise ValueError(
                f"올바른 Cron 표현식이 아닙니다. 5개의 필드가 필요합니다 (현재: {len(parts)}개). "
                "형식: '분 시 일 월 요일' (예: '0 9 * * *')"
            )
        return v.strip()

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """타임존 문자열 유효성 검증 (간단한 검증만)"""
        # 일반적인 타임존 형식 확인
        if not v or v.strip() == "":
            raise ValueError("타임존은 비어있을 수 없습니다.")
        return v.strip()
