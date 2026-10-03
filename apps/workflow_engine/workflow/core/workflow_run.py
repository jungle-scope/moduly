"""
WorkflowRun - 워크플로우 1회 실행

실행 한 번 동안의 상태(결과, 실행 중인 greenlet)와 스케줄링 루프를 담당합니다.
WorkflowEngine.execute*() 호출마다 새로 만들어지므로, 엔진은 여러 번 실행할 수 있습니다.

[GEVENT] asyncio에서 gevent로 전환:
- asyncio.Semaphore → gevent.pool.Pool
- asyncio.wait() → greenlet.ready() polling
- asyncio.create_task() → pool.spawn()
"""

import time
from typing import Any, Dict, Iterator, Set

import gevent
from gevent.pool import Pool

from apps.shared.schemas.workflow import NodeSchema
from apps.workflow_engine.workflow.core.run_reporter import NodeRun, RunReporter
from apps.workflow_engine.workflow.core.workflow_graph import WorkflowGraph

MAX_CONCURRENT_NODES = 10
DEFAULT_NODE_TIMEOUT = 300  # 초
POLL_INTERVAL = 0.01  # 초 - 완료된 greenlet이 없을 때 양보하는 시간


class WorkflowRun:
    """그래프를 따라 노드를 병렬 실행하고 진행 이벤트를 제너레이터로 내보냅니다."""

    def __init__(
        self,
        graph: WorkflowGraph,
        node_instances: Dict[str, Any],
        user_input: Dict[str, Any],
        reporter: RunReporter,
        stream_mode: bool,
        timeout: float,
        started_at: float,
    ):
        self.graph = graph
        self.node_instances = node_instances
        self.user_input = user_input
        self.reporter = reporter
        self.stream_mode = stream_mode
        self.timeout = timeout
        self.started_at = started_at

        self.results: Dict[str, Any] = {}
        # 한 번이라도 제출된 노드 (중복 실행 방지)
        self.scheduled: Set[str] = set()
        # [GEVENT] 실행 중인 greenlet → node_id
        self.running: Dict[Any, str] = {}
        # [GEVENT] Pool for concurrency control
        self.pool = Pool(size=MAX_CONCURRENT_NODES)

    def execute(self) -> Iterator[Dict[str, Any]]:
        """
        워크플로우를 실행하며 이벤트를 yield 합니다.

        - 스트림 모드: workflow_start / node_* / workflow_finish, 실패 시 error 이벤트
        - 배포 모드: workflow_finish만 yield, 실패 시 예외 발생
        """
        start_node = self.graph.find_start_node()

        try:
            if self.stream_mode:
                yield self.reporter.workflow_started()

            self._schedule(start_node)

            while self.running:
                self._check_timeout()

                yield from self.reporter.drain_events()

                completed = [
                    (greenlet, node_id)
                    for greenlet, node_id in list(self.running.items())
                    if greenlet.ready()
                ]

                if not completed:
                    gevent.sleep(POLL_INTERVAL)
                    continue

                for greenlet, node_id in completed:
                    del self.running[greenlet]

                    try:
                        self.results[node_id] = greenlet.get()
                    except Exception as e:
                        error_event = self.reporter.node_failed(node_id, str(e))

                        if self.stream_mode:
                            yield error_event

                        self._kill_running()
                        raise

                    self._schedule_ready_successors(node_id)

            # 남은 이벤트 모두 전달
            yield from self.reporter.drain_events()

            yield self.reporter.workflow_finished(self._final_data())

        except Exception as e:
            error_event = self.reporter.workflow_failed(str(e))

            if not self.stream_mode:
                raise
            yield error_event

    # ================================================================
    # 스케줄링
    # ================================================================

    def _schedule(self, node_id: str):
        """노드를 제출 대상으로 표시하고 실행을 시작합니다."""
        self.scheduled.add(node_id)
        self._submit_node(node_id)

    def _schedule_ready_successors(self, node_id: str):
        """완료된 노드의 다음 노드 중 아직 제출되지 않았고 실행 준비가 된 노드를 제출"""
        for next_node_id in self.graph.get_next_nodes(node_id, self.results[node_id]):
            if next_node_id not in self.scheduled and self.graph.is_ready(
                next_node_id, self.results
            ):
                self._schedule(next_node_id)

    def _check_timeout(self):
        """전체 타임아웃 체크"""
        if time.time() - self.started_at > self.timeout:
            self._kill_running()
            raise TimeoutError(f"Workflow timed out after {self.timeout} seconds.")

    def _kill_running(self):
        for greenlet in self.running:
            greenlet.kill()

    def _final_data(self) -> Any:
        """스트림 모드는 전체 결과를, 배포 모드는 AnswerNode 결과만 반환"""
        if self.stream_mode:
            return dict(self.results)
        return self._get_answer_node_result()

    def _get_answer_node_result(self) -> Dict[str, Any]:
        """배포 모드에서 AnswerNode의 결과만 추출하여 반환합니다."""
        answer_nodes = self.graph.nodes_by_type.get("answerNode", [])

        for node_id in answer_nodes:
            if node_id in self.results:
                return self.results[node_id]

    # ================================================================
    # 노드 실행
    # ================================================================

    def _submit_node(self, node_id: str):
        """
        개별 노드를 실행하기 위해 Greenlet 생성

        [GEVENT] asyncio.create_task() → pool.spawn()
        """
        if node_id not in self.node_instances:
            raise ValueError(f"노드 ID '{node_id}'를 찾을 수 없습니다.")

        node_instance = self.node_instances[node_id]
        node_schema = self.graph.node_schemas[node_id]

        inputs = self._build_inputs(node_id)
        node_run = self.reporter.node_started(node_id, node_schema, inputs)

        greenlet = self.pool.spawn(self._run_node, node_instance, node_schema, node_run)
        self.running[greenlet] = node_id

    def _build_inputs(self, node_id: str) -> Dict[str, Any]:
        """현재 노드가 실행에 필요한 모든 입력 데이터를 구성"""
        if self.graph.is_trigger(node_id):
            return self.user_input

        return dict(self.results)

    def _run_node(self, node_instance, node_schema: NodeSchema, node_run: NodeRun):
        """[greenlet] 타임아웃을 적용해 노드를 실행하고 node_finish 이벤트를 발행"""
        node_timeout = (
            node_schema.timeout
            if node_schema.timeout is not None
            else DEFAULT_NODE_TIMEOUT
        )

        try:
            # [GEVENT] 타임아웃 적용
            with gevent.Timeout(node_timeout):
                result = self._execute_node(node_instance, node_run)

        except gevent.Timeout:
            raise TimeoutError(
                f"Node '{node_run.node_id}' ({node_run.node_type}) timed out after {node_timeout} seconds."
            )

        self.reporter.node_finished(node_run, result)

        return result

    def _execute_node(self, node_instance, node_run: NodeRun):
        """노드 실행 + 노드 로그 기록"""
        try:
            result = node_instance.execute(node_run.inputs)
            self.reporter.node_log_finished(node_run, result)
            return result

        except Exception as e:
            self.reporter.node_log_failed(node_run, str(e))
            raise
