"""
RunReporter - 워크플로우 1회 실행의 진행 상황 보고

실행 중 발생하는 이벤트를 세 군데로 내보내는 일을 한 곳에서 담당합니다.
- WorkflowLogger: 실행 로그 (Log-System)
- Redis Pub/Sub: 실시간 이벤트
- 스트림 큐: execute_stream() 제너레이터로 전달할 이벤트

서브 워크플로우는 부모 실행에 포함되므로 로그/Pub/Sub을 내보내지 않습니다.
"""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, Optional

from gevent.queue import Queue

from apps.shared.pubsub import publish_workflow_event  # [GEVENT] Use sync version
from apps.shared.schemas.workflow import NodeSchema
from apps.workflow_engine.workflow.core.workflow_logger import WorkflowLogger


@dataclass
class NodeRun:
    """노드 1회 실행의 보고용 정보 (node_started → 완료/실패 보고까지 전달)"""

    node_id: str
    node_type: str
    inputs: Dict[str, Any]
    started_at: datetime
    log_id: Optional[Any] = None
    process_data: Optional[Dict[str, Any]] = None


class RunReporter:
    """워크플로우 1회 실행 동안의 로그 / Pub/Sub / 스트림 이벤트 발행"""

    def __init__(
        self,
        logger: WorkflowLogger,
        run_id: Optional[str],
        is_subworkflow: bool = False,
        stream_mode: bool = False,
    ):
        self.logger = logger
        self.run_id = run_id
        self.is_subworkflow = is_subworkflow
        # [GEVENT] greenlet에서 발생한 이벤트를 메인 루프로 전달하는 큐
        self.event_queue = Queue() if stream_mode else None

    # ================================================================
    # 노드 이벤트
    # ================================================================

    def node_started(
        self, node_id: str, node_schema: NodeSchema, inputs: Dict[str, Any]
    ) -> NodeRun:
        """노드 실행 시작: 노드 로그 생성 + node_start 이벤트"""
        node_run = NodeRun(
            node_id=node_id,
            node_type=node_schema.type,
            inputs=inputs,
            started_at=datetime.now(timezone.utc),
        )

        if not self.is_subworkflow:
            node_run.process_data = self._extract_node_options(node_schema)
            node_run.log_id = self.logger.create_node_log(
                node_id,
                node_schema.type,
                inputs,
                process_data=node_run.process_data,
            )

        self._emit("node_start", {"node_id": node_id, "node_type": node_schema.type})
        return node_run

    def node_log_finished(self, node_run: NodeRun, result: Any):
        """노드 완료 로깅"""
        if self.is_subworkflow:
            return

        self.logger.update_node_log_finish(
            node_run.log_id,
            node_run.node_id,
            result,
            node_type=node_run.node_type,
            inputs=node_run.inputs,
            process_data=node_run.process_data,
            started_at=node_run.started_at,
        )

    def node_log_failed(self, node_run: NodeRun, error_msg: str):
        """노드 에러 로깅"""
        if self.is_subworkflow:
            return

        self.logger.update_node_log_error(
            node_run.log_id,
            node_run.node_id,
            error_msg,
            node_type=node_run.node_type,
            inputs=node_run.inputs,
            process_data=node_run.process_data,
            started_at=node_run.started_at,
        )

    def node_finished(self, node_run: NodeRun, result: Any):
        """node_finish 이벤트"""
        self._emit(
            "node_finish",
            {
                "node_id": node_run.node_id,
                "node_type": node_run.node_type,
                "output": result,
            },
        )

    def node_failed(self, node_id: str, error_msg: str) -> Dict[str, Any]:
        """
        노드 실패로 워크플로우가 중단될 때: run 에러 로그 + 스트림용 error 이벤트 반환

        NOTE: 서브 워크플로우 여부와 무관하게 run 에러 로그를 남깁니다. (기존 동작 유지)
        """
        self.logger.update_run_log_error(error_msg)
        return {"type": "error", "data": {"node_id": node_id, "message": error_msg}}

    # ================================================================
    # 워크플로우 이벤트
    # ================================================================

    def workflow_started(self) -> Dict[str, Any]:
        """스트림용 workflow_start 이벤트 반환"""
        return {"type": "workflow_start", "data": {}}

    def workflow_finished(self, final_data: Any) -> Dict[str, Any]:
        """워크플로우 완료: run 로그 + Pub/Sub 발행, workflow_finish 이벤트 반환"""
        if not self.is_subworkflow:
            self.logger.update_run_log_finish(final_data)
        self._publish("workflow_finish", final_data)
        return {"type": "workflow_finish", "data": final_data}

    def workflow_failed(self, error_msg: str) -> Dict[str, Any]:
        """워크플로우 실패: run 에러 로그 + Pub/Sub 발행, error 이벤트 반환"""
        if not self.is_subworkflow:
            self.logger.update_run_log_error(error_msg)
        self._publish("error", {"message": error_msg})
        return {"type": "error", "data": {"message": error_msg}}

    # ================================================================
    # 스트림 큐
    # ================================================================

    def drain_events(self) -> Iterator[Dict[str, Any]]:
        """스트림 큐에 쌓인 이벤트를 모두 꺼냅니다. (스트림 모드가 아니면 비어 있음)"""
        if self.event_queue is None:
            return

        while not self.event_queue.empty():
            try:
                yield self.event_queue.get_nowait()
            except Exception:
                break

    # ================================================================
    # 내부 헬퍼
    # ================================================================

    def _emit(self, event_type: str, data: Dict[str, Any]):
        """Pub/Sub 발행 + 스트림 큐 적재"""
        self._publish(event_type, data)
        if self.event_queue is not None:
            self.event_queue.put({"type": event_type, "data": dict(data)})

    def _publish(self, event_type: str, data: Any):
        """Redis Pub/Sub 이벤트 발행"""
        if self.run_id and not self.is_subworkflow:
            publish_workflow_event(self.run_id, event_type, data)

    @staticmethod
    def _extract_node_options(node_schema: NodeSchema) -> Dict[str, Any]:
        """노드 설정을 process_data용 스냅샷으로 추출합니다."""
        try:
            data = dict(node_schema.data) if node_schema.data else {}

            return {
                "node_options": data,
                "node_title": data.get("title", ""),
            }
        except Exception:
            return {}
