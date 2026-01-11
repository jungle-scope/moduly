import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from shared.db.models.workflow_run import WorkflowNodeRun, WorkflowRun
from sqlalchemy import desc
from sqlalchemy.orm import Session


class LogService:
    @staticmethod
    def create_run_log(db: Session, data: Dict[str, Any]) -> WorkflowRun:
        run = WorkflowRun(**data)
        if not run.started_at:
            run.started_at = datetime.now(timezone.utc)
        db.add(run)
        db.commit()
        db.refresh(run)
        return run

    @staticmethod
    def update_run_log(
        db: Session, run_id: uuid.UUID, data: Dict[str, Any]
    ) -> Optional[WorkflowRun]:
        run = db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
        if not run:
            return None

        for key, value in data.items():
            if hasattr(run, key):
                setattr(run, key, value)

        # 만약 finished_at이 설정되고 status가 완료 상태라면 duration 계산
        if "finished_at" in data and data["finished_at"] and run.started_at:
            # Pydantic or dict might have parsed it as str
            finished = data["finished_at"]
            if isinstance(finished, str):
                finished = datetime.fromisoformat(finished)

            # started_at might be offset-naive in DB or loaded as such, ensure timezone awareness match
            start = run.started_at
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if finished.tzinfo is None:
                finished = finished.replace(tzinfo=timezone.utc)

            run.duration = (finished - start).total_seconds()

        db.commit()
        db.refresh(run)
        return run

    @staticmethod
    def create_node_log(
        db: Session, run_id: uuid.UUID, data: Dict[str, Any]
    ) -> WorkflowNodeRun:
        # Pydantic model might send id=None, remove it to let DB/Server generate it
        if "id" in data and data["id"] is None:
            data.pop("id")

        node_run = WorkflowNodeRun(workflow_run_id=run_id, **data)
        if not node_run.started_at:
            node_run.started_at = datetime.now(timezone.utc)
        db.add(node_run)
        db.commit()
        db.refresh(node_run)
        return node_run

    @staticmethod
    def update_node_log(
        db: Session, node_run_id: uuid.UUID, data: Dict[str, Any]
    ) -> Optional[WorkflowNodeRun]:
        node_run = (
            db.query(WorkflowNodeRun).filter(WorkflowNodeRun.id == node_run_id).first()
        )
        if not node_run:
            # Fallback: Try finding by node_id and run_id if id is not passed (depends on usage)
            # But here we assume ID is known or passed correctly.
            return None

        for key, value in data.items():
            if hasattr(node_run, key):
                setattr(node_run, key, value)

        db.commit()
        db.refresh(node_run)
        return node_run

    @staticmethod
    def update_node_log_by_node_id(
        db: Session, run_id: uuid.UUID, node_id: str, data: Dict[str, Any]
    ) -> Optional[WorkflowNodeRun]:
        """
        node_id로 노드 로그를 업데이트합니다.

        [Upsert 로직] 노드가 없으면 자동으로 생성합니다.
        이는 비동기 로그 처리 시 create_node와 update_node의 순서가
        보장되지 않을 때 발생하는 레이스 컨디션을 해결합니다.
        """
        # Find the latest node run for this node in this run
        node_run = (
            db.query(WorkflowNodeRun)
            .filter(
                WorkflowNodeRun.workflow_run_id == run_id,
                WorkflowNodeRun.node_id == node_id,
            )
            .order_by(desc(WorkflowNodeRun.started_at))
            .first()
        )

        if not node_run:
            # [Upsert] 노드가 없으면 새로 생성
            node_run = WorkflowNodeRun(
                workflow_run_id=run_id,
                node_id=node_id,
                node_type=data.get("node_type", "unknown"),
                status="running",
                started_at=datetime.now(timezone.utc),
            )
            db.add(node_run)
            db.flush()  # ID 생성을 위해 flush

        for key, value in data.items():
            if hasattr(node_run, key):
                setattr(node_run, key, value)

        db.commit()
        db.refresh(node_run)
        return node_run

    @staticmethod
    def get_workflow_runs(
        db: Session, workflow_id: uuid.UUID, skip: int = 0, limit: int = 20
    ) -> List[WorkflowRun]:
        return (
            db.query(WorkflowRun)
            .filter(WorkflowRun.workflow_id == workflow_id)
            .order_by(desc(WorkflowRun.started_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_run_detail(db: Session, run_id: uuid.UUID) -> Optional[WorkflowRun]:
        return db.query(WorkflowRun).filter(WorkflowRun.id == run_id).first()
