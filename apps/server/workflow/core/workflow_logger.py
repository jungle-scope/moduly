"""
워크플로우 실행 로깅 유틸리티 (Celery 기반)

WorkflowEngine의 실행 이력을 Log-System 마이크로서비스에 비동기로 전송합니다.
- WorkflowRun: 워크플로우 전체 실행 로그
- WorkflowNodeRun: 개별 노드 실행 로그

[리팩토링 이력]
- v1: 동기식 DB 저장
- v2: 비동기식 Queue + Worker Thread 방식 (인스턴스별 스레드)
- v3: 애플리케이션 레벨 공유 LogWorkerPool 사용
- v4 (현재): Celery 태스크를 통한 마이크로서비스 분리
  - 모든 DB 작업은 apps/log_system/tasks.py에서 수행
  - 이 파일은 Celery 태스크 호출만 담당
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from apps.shared.celery_app import celery_app


class WorkflowLogger:
    """
    워크플로우 실행 로깅을 담당하는 유틸리티 클래스

    Celery 태스크를 통해 Log-System 마이크로서비스로 로그 전송
    - 비동기 처리: Celery 큐를 통해 로그 저장 요청 전송
    - 마이크로서비스 분리: 로그 저장 로직이 apps/log_system에서 실행

    Context Manager 패턴을 지원합니다.

    Usage:
        with WorkflowLogger() as logger:
            logger.create_run_log(...)
    """

    def __init__(self, db=None):
        """
        Args:
            db: SQLAlchemy 세션 (하위 호환성을 위해 유지, 실제로는 사용하지 않음)
        """
        self.workflow_run_id: Optional[uuid.UUID] = None

    def _serialize_for_celery(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Celery 태스크용 데이터 직렬화 (UUID, datetime 변환)"""
        serialized = {}
        for key, value in data.items():
            if isinstance(value, uuid.UUID):
                serialized[key] = str(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, dict):
                serialized[key] = self._serialize_for_celery(value)
            else:
                serialized[key] = value
        return serialized

    def _submit_log(self, task_name: str, data: Dict[str, Any]):
        """Celery 태스크로 로그 작업 제출"""
        serialized_data = self._serialize_for_celery(data)
        celery_app.send_task(task_name, args=[serialized_data])

    def __enter__(self):
        """Context Manager 진입"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context Manager 종료"""
        return False

    def shutdown(self):
        """로깅 종료 처리 (호환성을 위해 유지, no-op)"""
        pass

    # ============================================================
    # 공개 메서드 (Celery 태스크 호출)
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

        run_id = uuid.uuid4()
        self.workflow_run_id = run_id

        data = {
            "run_id": run_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "user_input": user_input,
            "is_deployed": is_deployed,
            "trigger_mode": execution_context.get("trigger_mode"),
            "deployment_id": execution_context.get("deployment_id"),
            "workflow_version": execution_context.get("workflow_version"),
            "started_at": datetime.now(timezone.utc),
        }
        self._submit_log("log.create_run", data)
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
        self._submit_log("log.update_run_finish", data)

    def update_run_log_error(self, error_message: str):
        """워크플로우 실행 에러 로그 업데이트"""
        if not self.workflow_run_id:
            return

        data = {
            "run_id": self.workflow_run_id,
            "error_message": error_message,
            "finished_at": datetime.now(timezone.utc),
        }
        self._submit_log("log.update_run_error", data)

    def create_node_log(
        self,
        node_id: str,
        node_type: str,
        inputs: Dict[str, Any],
        process_data: Optional[Dict[str, Any]] = None,
    ):
        """노드 실행 로그 생성"""
        if not self.workflow_run_id:
            return

        data = {
            "workflow_run_id": self.workflow_run_id,
            "node_id": node_id,
            "node_type": node_type,
            "inputs": inputs,
            "process_data": process_data or {},
            "started_at": datetime.now(timezone.utc),
        }
        self._submit_log("log.create_node", data)

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
        self._submit_log("log.update_node_finish", data)

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
        self._submit_log("log.update_node_error", data)
