import uuid
from datetime import datetime, timezone
from typing import List, Optional

from shared.db.base import Base
from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class WorkflowRun(Base):
    """
    워크플로우 전체 실행 이력을 저장하는 테이블입니다.
    하나의 워크플로우 실행(Run)은 여러 개의 노드 실행(Node Run)을 포함합니다.
    """

    __tablename__ = "workflow_runs"

    # === 기본 식별자 ===
    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # === 외래 키 (관계) ===
    # 어떤 워크플로우가 실행되었는지
    # TODO: ForeignKey 제약은 전체 DB 스키마 정리 후 추가
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=False,
    )
    # 누가 실행했는지 (익명 실행이 없다면 nullable=False)
    # TODO: ForeignKey 제약은 전체 DB 스키마 정리 후 추가
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)

    # === 실행 상태 정보 ===
    # running, success, failed, stopped
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")
    # manual(수동), api(외부 호출), scheduler(스케줄러) 등
    trigger_mode: Mapped[str] = mapped_column(String, nullable=False, default="manual")

    # === 입출력 데이터 (스냅샷) ===
    # 실행 시점의 사용자 입력값 전체
    inputs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # 실행 완료 후 최종 결과값
    outputs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # === 에러 정보 ===
    # 실패 시 에러 메시지
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # === 시간 정보 ===
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # 실행 소요 시간 (초 단위) - 편의상 저장
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # === 메타데이터 ===
    # 클라이언트 IP, User Agent 등 추후 확장을 위한 필드
    # [FIX] 'metadata'는 SQLAlchemy 예약어이므로 'meta_info'로 변경
    meta_info: Mapped[Optional[dict]] = mapped_column("meta_info", JSONB, nullable=True)

    # === 비용/토큰 집계 (Denormalized) ===
    total_tokens: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, default=0
    )
    total_cost: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 6), nullable=True, default=0.0
    )

    # === 배포 정보 (선택) ===
    # 배포된 버전으로 실행된 경우 연결
    # TODO: ForeignKey 제약은 workflow_deployments 테이블 생성 후 추가
    deployment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PGUUID(as_uuid=True), nullable=True
    )
    workflow_version: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )  # 배포 버전 스냅샷

    # === Relationships ===
    # 1:N 관계 - 하나의 실행은 여러 노드 실행 기록을 가짐
    node_runs: Mapped[List["WorkflowNodeRun"]] = relationship(
        "WorkflowNodeRun", back_populates="workflow_run", cascade="all, delete-orphan"
    )

    # LLM 사용 로그와 연동 (1:N) - 하나의 워크플로우 실행에서 여러 번의 LLM 호출이 발생할 수 있음


class WorkflowNodeRun(Base):
    """
    워크플로우 내 개별 노드의 실행 이력을 저장하는 테이블입니다.
    디버깅을 위해 입력값(inputs)과 출력값(outputs)을 상세히 기록합니다.
    """

    __tablename__ = "workflow_node_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # === 외래 키 ===
    workflow_run_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_runs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # === 노드 정보 ===
    # 워크플로우 그래프 상의 노드 ID (UUID 형식이 아닐 수 있음, 예: 'node-1')
    node_id: Mapped[str] = mapped_column(String, nullable=False)
    # 노드 타입 (예: startNode, llmNode, codeNode 등)
    node_type: Mapped[str] = mapped_column(String, nullable=False)

    # === 실행 상태 ===
    # running, success, failed, skipped
    status: Mapped[str] = mapped_column(String, nullable=False, default="running")

    # === 상세 데이터 ===
    # 이 노드에 들어온 입력값
    inputs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # 이 노드가 뱉어낸 출력값
    outputs: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # 처리 과정 중 추가 데이터 (예: 선택된 분기 핸들 등)
    process_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # === 에러 정보 ===
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # === 시간 정보 ===
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # === Relationships ===
    workflow_run: Mapped["WorkflowRun"] = relationship(
        "WorkflowRun", back_populates="node_runs"
    )
