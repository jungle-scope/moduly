"""
워크플로우 실행 로깅 유틸리티

WorkflowEngine의 실행 이력을 DB에 기록하는 역할을 담당합니다.
- WorkflowRun: 워크플로우 전체 실행 로그
- WorkflowNodeRun: 개별 노드 실행 로그

[리팩토링 이력]
- v1: 동기식 DB 저장
- v2: 비동기식 Queue + Worker Thread 방식 (인스턴스별 스레드)
- v3 (현재): 애플리케이션 레벨 공유 LogWorkerPool 사용
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models.llm import LLMUsageLog
from db.models.workflow_run import WorkflowNodeRun, WorkflowRun


class WorkflowLoggerDBOps:
    """
    DB 작업 로직만 분리 (LogWorkerPool에서 사용)

    기존 WorkflowLogger의 _db_xxx 메서드들을 정적 메서드로 이동하여
    LogWorkerPool에서 재사용할 수 있도록 함.
    """

    @staticmethod
    def create_run_log(session: Session, data: Dict[str, Any]):
        """워크플로우 실행 로그 생성"""
        run_log = WorkflowRun(
            id=data["run_id"],
            workflow_id=uuid.UUID(str(data["workflow_id"])),
            user_id=uuid.UUID(str(data["user_id"])),
            status="running",
            trigger_mode="deployed" if data["is_deployed"] else "manual",
            inputs=data["user_input"],
            started_at=data["started_at"],
            deployment_id=uuid.UUID(str(data["deployment_id"]))
            if data["deployment_id"]
            else None,
            workflow_version=data["workflow_version"],
        )
        session.add(run_log)
        session.commit()

    @staticmethod
    def update_run_log_finish(session: Session, data: Dict[str, Any]):
        """워크플로우 실행 완료 로그 업데이트"""
        run_log = (
            session.query(WorkflowRun).filter(WorkflowRun.id == data["run_id"]).first()
        )
        if run_log:
            run_log.status = "success"
            run_log.outputs = data["outputs"]
            run_log.finished_at = data["finished_at"]

            if run_log.started_at:
                run_log.duration = (
                    run_log.finished_at - run_log.started_at
                ).total_seconds()

            # 비용 및 토큰 집계
            stats = (
                session.query(
                    func.sum(
                        LLMUsageLog.prompt_tokens + LLMUsageLog.completion_tokens
                    ).label("total_tokens"),
                    func.sum(LLMUsageLog.total_cost).label("total_cost"),
                )
                .filter(LLMUsageLog.workflow_run_id == data["run_id"])
                .first()
            )

            if stats:
                run_log.total_tokens = stats.total_tokens or 0
                run_log.total_cost = stats.total_cost or 0.0

            session.commit()

    @staticmethod
    def update_run_log_error(session: Session, data: Dict[str, Any]):
        """워크플로우 실행 에러 로그 업데이트"""
        run_log = (
            session.query(WorkflowRun).filter(WorkflowRun.id == data["run_id"]).first()
        )
        if run_log:
            run_log.status = "failed"
            run_log.error_message = data["error_message"]
            run_log.finished_at = data["finished_at"]

            if run_log.started_at:
                run_log.duration = (
                    run_log.finished_at - run_log.started_at
                ).total_seconds()

            session.commit()

    @staticmethod
    def create_node_log(session: Session, data: Dict[str, Any]):
        """노드 실행 로그 생성"""
        node_run = WorkflowNodeRun(
            workflow_run_id=data["workflow_run_id"],
            node_id=data["node_id"],
            node_type=data["node_type"],
            status="running",
            inputs=data["inputs"],
            started_at=data["started_at"],
        )
        session.add(node_run)
        session.commit()

    @staticmethod
    def update_node_log_finish(session: Session, data: Dict[str, Any]):
        """노드 실행 완료 로그 업데이트"""
        node_run = (
            session.query(WorkflowNodeRun)
            .filter(WorkflowNodeRun.workflow_run_id == data["workflow_run_id"])
            .filter(WorkflowNodeRun.node_id == data["node_id"])
            .order_by(WorkflowNodeRun.started_at.desc())
            .first()
        )

        if node_run:
            node_run.status = "success"
            outputs = data["outputs"]
            if isinstance(outputs, dict):
                node_run.outputs = outputs
            else:
                node_run.outputs = {"result": outputs}

            node_run.finished_at = data["finished_at"]
            session.commit()

    @staticmethod
    def update_node_log_error(session: Session, data: Dict[str, Any]):
        """노드 실행 에러 로그 업데이트"""
        node_run = (
            session.query(WorkflowNodeRun)
            .filter(WorkflowNodeRun.workflow_run_id == data["workflow_run_id"])
            .filter(WorkflowNodeRun.node_id == data["node_id"])
            .order_by(WorkflowNodeRun.started_at.desc())
            .first()
        )

        if node_run:
            node_run.status = "failed"
            node_run.error_message = data["error_message"]
            node_run.finished_at = data["finished_at"]
            session.commit()


class WorkflowLogger:
    """
    워크플로우 실행 로깅을 담당하는 유틸리티 클래스

    [리팩토링] 인스턴스별 스레드 대신 공유 LogWorkerPool 사용
    - 리소스 효율성: 고정된 수의 워커 스레드만 사용
    - DB 커넥션 절약: 워커 수만큼의 DB 세션만 유지
    - 간편한 종료: 앱 종료 시 한 번만 shutdown 호출

    Context Manager 패턴을 지원합니다.

    Usage:
        # 권장: Context Manager 사용
        with WorkflowLogger() as logger:
            logger.create_run_log(...)

        # 또는 직접 사용
        logger = WorkflowLogger()
        logger.create_run_log(...)
    """

    def __init__(self, db: Optional[Session] = None):
        """
        Args:
            db: SQLAlchemy 세션 (하위 호환성을 위해 유지, 실제로는 사용하지 않음)
        """
        self.workflow_run_id: Optional[uuid.UUID] = None

        # 공유 워커 풀 참조 (지연 로딩)
        self._pool = None

    def _get_pool(self):
        """공유 워커 풀을 지연 로딩으로 가져옴"""
        if self._pool is None:
            from workflow.core.log_worker_pool import get_log_worker_pool

            self._pool = get_log_worker_pool()
        return self._pool

    def __enter__(self):
        """Context Manager 진입"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context Manager 종료 - 공유 풀 사용으로 인스턴스별 종료 불필요"""
        return False  # 예외를 다시 raise

    def shutdown(self):
        """
        로깅 종료 처리 (호환성을 위해 유지)

        공유 LogWorkerPool을 사용하므로 인스턴스별 종료는 no-op.
        풀은 앱 종료 시 shutdown_log_worker_pool()으로 종료됩니다.
        """
        pass

    # ============================================================
    # 공개 메서드 (공유 풀에 작업 제출)
    # ============================================================

    def create_run_log(
        self,
        workflow_id: str,
        user_id: str,
        user_input: Dict[str, Any],
        is_deployed: bool,
        execution_context: Dict[str, Any],
    ) -> Optional[uuid.UUID]:
        """워크플로우 실행 로그 생성"""
        if not workflow_id or not user_id:
            return None

        # UUID 미리 생성
        run_id = uuid.uuid4()
        self.workflow_run_id = run_id

        data = {
            "run_id": run_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "user_input": user_input,
            "is_deployed": is_deployed,
            "deployment_id": execution_context.get("deployment_id"),
            "workflow_version": execution_context.get("workflow_version"),
            "started_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "create_run", "data": data})
        return run_id

    def update_run_log_finish(self, outputs: Dict[str, Any]):
        """워크플로우 실행 완료 로그 업데이트"""
        if not self.workflow_run_id:
            return

        data = {
            "run_id": self.workflow_run_id,
            "outputs": outputs,
            "finished_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "update_run_finish", "data": data})

    def update_run_log_error(self, error_message: str):
        """워크플로우 실행 에러 로그 업데이트"""
        if not self.workflow_run_id:
            return

        data = {
            "run_id": self.workflow_run_id,
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "update_run_error", "data": data})

    def create_node_log(self, node_id: str, node_type: str, inputs: Dict[str, Any]):
        """노드 실행 로그 생성"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "node_type": node_type,
            "inputs": inputs,
            "started_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "create_node", "data": data})

    def update_node_log_finish(self, node_id: str, outputs: Any):
        """노드 실행 완료 로그 업데이트"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "outputs": outputs,
            "finished_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "update_node_finish", "data": data})

    def update_node_log_error(self, node_id: str, error_message: str):
        """노드 실행 에러 로그 업데이트"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc),
        }
        self._get_pool().submit({"type": "update_node_error", "data": data})
