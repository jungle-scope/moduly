"""
워크플로우 실행 로깅 유틸리티

WorkflowEngine의 실행 이력을 DB에 기록하는 역할을 담당합니다.
- WorkflowRun: 워크플로우 전체 실행 로그
- WorkflowNodeRun: 개별 노드 실행 로그

[성능 개선 사항]
- 동기식 DB 저장 -> 비동기식 Queue + Worker Thread 방식으로 변경
- 메인 실행 루프의 지연(Latency)을 최소화
"""

import queue
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models.llm import LLMUsageLog
from db.models.workflow_run import WorkflowNodeRun, WorkflowRun
from db.session import SessionLocal  # SessionLocal 필요


class WorkflowLogger:
    """
    워크플로우 실행 로깅을 담당하는 유틸리티 클래스 (Async Version)

    Context Manager 패턴을 지원하여 리소스 누수를 방지합니다.

    Usage:
        # 권장: Context Manager 사용
        with WorkflowLogger(db) as logger:
            logger.create_run_log(...)
            # 자동으로 shutdown() 호출됨

        # 또는 수동 관리
        logger = WorkflowLogger(db)
        try:
            logger.create_run_log(...)
        finally:
            logger.shutdown()
    """

    # Queue 크기 제한 (백프레셔 적용)
    MAX_QUEUE_SIZE = 1000

    def __init__(self, db: Optional[Session] = None):
        """
        Args:
            db: SQLAlchemy 세션 (하위 호환성을 위해 유지하지만, 실제 로깅은 내부의 별도 세션 사용)
        """
        self.workflow_run_id: Optional[uuid.UUID] = None
        self.log_queue = queue.Queue(maxsize=self.MAX_QUEUE_SIZE)
        self._is_shutdown = False
        self._shutdown_lock = threading.Lock()

        # 백그라운드 워커 스레드 시작
        self.worker_thread = threading.Thread(target=self._log_worker, daemon=True)
        self.worker_thread.start()

    def __enter__(self):
        """Context Manager 진입"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context Manager 종료 - 자동으로 shutdown() 호출"""
        self.shutdown()
        return False  # 예외를 다시 raise

    def __del__(self):
        """
        객체 소멸 시 안전망 (Safety Net)
        - Context Manager를 사용하지 않은 경우에도 리소스 정리 시도
        - 주의: __del__은 호출 시점이 보장되지 않으므로 Context Manager 사용 권장
        """
        self.shutdown()

    def shutdown(self):
        """
        로깅 종료 처리 (Thread-safe)
        - 중복 호출 방지
        - 큐에 남은 작업을 모두 처리할 때까지 대기
        - 워커 스레드 종료
        """
        with self._shutdown_lock:
            if self._is_shutdown:
                return  # 이미 종료됨
            self._is_shutdown = True

        self.log_queue.put(None)  # 워커 중지를 위한 센티널(Sentinel)
        self.worker_thread.join(timeout=5.0)  # 최대 5초 대기 (무한 대기 방지)

    def _log_worker(self):
        """백그라운드에서 로그를 DB에 기록하는 워커"""
        # 별도의 DB 세션 생성 (스레드 독립성 보장)
        session = SessionLocal()

        try:
            while True:
                task = self.log_queue.get()
                if task is None:  # 종료 신호
                    break

                try:
                    self._process_task(session, task)
                except Exception as e:
                    print(f"[로깅 워커 에러] 작업 처리 실패: {e}")
                    session.rollback()
                finally:
                    self.log_queue.task_done()
        finally:
            session.close()

    def _process_task(self, session: Session, task: Dict[str, Any]):
        """개별 로그 작업 처리 (DB 쓰기)"""
        task_type = task.get("type")
        data = task.get("data")

        if task_type == "create_run":
            self._db_create_run_log(session, data)
        elif task_type == "update_run_finish":
            self._db_update_run_log_finish(session, data)
        elif task_type == "update_run_error":
            self._db_update_run_log_error(session, data)
        elif task_type == "create_node":
            self._db_create_node_log(session, data)
        elif task_type == "update_node_finish":
            self._db_update_node_log_finish(session, data)
        elif task_type == "update_node_error":
            self._db_update_node_log_error(session, data)

    # ============================================================
    # 공개 메서드 (큐잉 처리)
    # ============================================================

    def create_run_log(
        self,
        workflow_id: str,
        user_id: str,
        user_input: Dict[str, Any],
        is_deployed: bool,
        execution_context: Dict[str, Any],
    ) -> Optional[uuid.UUID]:
        """워크플로우 실행 로그 생성 (Async)"""
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
        self.log_queue.put({"type": "create_run", "data": data})
        return run_id

    def update_run_log_finish(self, outputs: Dict[str, Any]):
        """워크플로우 실행 완료 로그 업데이트 (Async)"""
        if not self.workflow_run_id:
            return

        data = {
            "run_id": self.workflow_run_id,
            "outputs": outputs,
            "finished_at": datetime.now(timezone.utc),
        }
        self.log_queue.put({"type": "update_run_finish", "data": data})

    def update_run_log_error(self, error_message: str):
        """워크플로우 실행 에러 로그 업데이트 (Async)"""
        if not self.workflow_run_id:
            return

        data = {
            "run_id": self.workflow_run_id,
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc),
        }
        self.log_queue.put({"type": "update_run_error", "data": data})

    def create_node_log(self, node_id: str, node_type: str, inputs: Dict[str, Any]):
        """노드 실행 로그 생성 (Async)"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "node_type": node_type,
            "inputs": inputs,
            "started_at": datetime.now(timezone.utc),
        }
        self.log_queue.put({"type": "create_node", "data": data})

    def update_node_log_finish(self, node_id: str, outputs: Any):
        """노드 실행 완료 로그 업데이트 (Async)"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "outputs": outputs,
            "finished_at": datetime.now(timezone.utc),
        }
        self.log_queue.put({"type": "update_node_finish", "data": data})

    def update_node_log_error(self, node_id: str, error_message: str):
        """노드 실행 에러 로그 업데이트 (Async)"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc),
        }
        self.log_queue.put({"type": "update_node_error", "data": data})

    # ============================================================
    # DB 작업 (워커 스레드에서 실행됨)
    # ============================================================

    def _db_create_run_log(self, session: Session, data: Dict[str, Any]):
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

    def _db_update_run_log_finish(self, session: Session, data: Dict[str, Any]):
        run_log = (
            session.query(WorkflowRun).filter(WorkflowRun.id == data["run_id"]).first()
        )
        if run_log:
            run_log.status = "success"
            run_log.outputs = data["outputs"]
            run_log.finished_at = data["finished_at"]

            if run_log.started_at:
                # 타임존 인식 계산
                if run_log.started_at.tzinfo is None:
                    # DB가 naive datetime을 반환할 경우 (UTC에서는 발생하지 않아야 함)
                    pass
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

    def _db_update_run_log_error(self, session: Session, data: Dict[str, Any]):
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

    def _db_create_node_log(self, session: Session, data: Dict[str, Any]):
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

    def _db_update_node_log_finish(self, session: Session, data: Dict[str, Any]):
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

    def _db_update_node_log_error(self, session: Session, data: Dict[str, Any]):
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
