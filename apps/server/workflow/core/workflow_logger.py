"""
워크플로우 실행 로깅 유틸리티

WorkflowEngine의 실행 이력을 DB에 기록하는 역할을 담당합니다.
- WorkflowRun: 워크플로우 전체 실행 로그
- WorkflowNodeRun: 개별 노드 실행 로그
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models.workflow_run import WorkflowRun, WorkflowNodeRun
from db.models.llm import LLMUsageLog


class WorkflowLogger:
    """워크플로우 실행 로깅을 담당하는 유틸리티 클래스"""

    def __init__(self, db: Optional[Session] = None):
        """
        Args:
            db: SQLAlchemy 세션 (None이면 로깅 비활성화)
        """
        self.db = db
        self.workflow_run_id: Optional[uuid.UUID] = None

    def create_run_log(
        self,
        workflow_id: str,
        user_id: str,
        user_input: Dict[str, Any],
        is_deployed: bool,
        execution_context: Dict[str, Any]
    ) -> Optional[uuid.UUID]:
        """워크플로우 실행 로그 생성"""
        if not self.db:
            return None

        try:
            if not workflow_id or not user_id:
                return None

            run_log = WorkflowRun(
                workflow_id=uuid.UUID(str(workflow_id)),
                user_id=uuid.UUID(str(user_id)),
                status="running",
                trigger_mode="deployed" if is_deployed else "manual",
                inputs=user_input,
                started_at=datetime.now(timezone.utc),
                deployment_id=uuid.UUID(str(execution_context.get("deployment_id"))) 
                    if execution_context.get("deployment_id") else None,
                workflow_version=execution_context.get("workflow_version")
            )
            self.db.add(run_log)
            self.db.commit()
            self.db.refresh(run_log)
            self.workflow_run_id = run_log.id
            return run_log.id
            
        except Exception as e:
            print(f"[Logging Error] Create Run Log Failed: {e}")
            self.db.rollback()
            return None

    def update_run_log_finish(self, outputs: Dict[str, Any]):
        """워크플로우 실행 완료 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return
        
        try:
            run_log = self.db.query(WorkflowRun).filter(
                WorkflowRun.id == self.workflow_run_id
            ).first()
            
            if run_log:
                run_log.status = "success"
                run_log.outputs = outputs
                run_log.finished_at = datetime.now(timezone.utc)
                
                if run_log.started_at:
                    run_log.duration = (run_log.finished_at - run_log.started_at).total_seconds()
                
                # Cost & Token Aggregation
                stats = (
                    self.db.query(
                        func.sum(LLMUsageLog.prompt_tokens + LLMUsageLog.completion_tokens).label("total_tokens"),
                        func.sum(LLMUsageLog.total_cost).label("total_cost")
                    )
                    .filter(LLMUsageLog.workflow_run_id == self.workflow_run_id)
                    .first()
                )
                
                if stats:
                    run_log.total_tokens = stats.total_tokens or 0
                    run_log.total_cost = stats.total_cost or 0.0

                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Run Log Failed: {e}")

    def update_run_log_error(self, error_message: str):
        """워크플로우 실행 에러 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return
        
        try:
            run_log = self.db.query(WorkflowRun).filter(
                WorkflowRun.id == self.workflow_run_id
            ).first()
            
            if run_log:
                run_log.status = "failed"
                run_log.error_message = error_message
                run_log.finished_at = datetime.now(timezone.utc)
                
                if run_log.started_at:
                    run_log.duration = (run_log.finished_at - run_log.started_at).total_seconds()

                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Run Log Error Failed: {e}")

    def create_node_log(self, node_id: str, node_type: str, inputs: Dict[str, Any]):
        """노드 실행 로그 생성"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            node_run = WorkflowNodeRun(
                workflow_run_id=self.workflow_run_id,
                node_id=node_id,
                node_type=node_type,
                status="running",
                inputs=inputs,
                started_at=datetime.now(timezone.utc)
            )
            self.db.add(node_run)
            self.db.commit()
            
        except Exception as e:
            print(f"[Logging Error] Create Node Log Failed: {e}")
            self.db.rollback()

    def update_node_log_finish(self, node_id: str, outputs: Any):
        """노드 실행 완료 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            node_run = (
                self.db.query(WorkflowNodeRun)
                .filter(WorkflowNodeRun.workflow_run_id == self.workflow_run_id)
                .filter(WorkflowNodeRun.node_id == node_id)
                .order_by(WorkflowNodeRun.started_at.desc())
                .first()
            )
            
            if node_run:
                node_run.status = "success"
                if isinstance(outputs, dict):
                    node_run.outputs = outputs
                else:
                    node_run.outputs = {"result": outputs}
                
                node_run.finished_at = datetime.now(timezone.utc)
                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Node Log Failed: {e}")

    def update_node_log_error(self, node_id: str, error_message: str):
        """노드 실행 에러 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            node_run = (
                self.db.query(WorkflowNodeRun)
                .filter(WorkflowNodeRun.workflow_run_id == self.workflow_run_id)
                .filter(WorkflowNodeRun.node_id == node_id)
                .order_by(WorkflowNodeRun.started_at.desc())
                .first()
            )
            
            if node_run:
                node_run.status = "failed"
                node_run.error_message = error_message
                node_run.finished_at = datetime.now(timezone.utc)
                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Node Log Error Failed: {e}")
