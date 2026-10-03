"""
WorkflowEngine - Gevent-based Workflow Execution Engine

[GEVENT] Migrated from asyncio to gevent for Celery gevent pool compatibility.
"""

import time
import types
import uuid
from typing import Any, Dict, List, Optional, Union

import gevent
from gevent.pool import Pool
from sqlalchemy.orm import Session

from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.run_reporter import NodeRun, RunReporter
from apps.workflow_engine.workflow.core.workflow_graph import NOTE_TYPE, WorkflowGraph
from apps.workflow_engine.workflow.core.workflow_logger import WorkflowLogger
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory

MAX_CONCURRENT_NODES = 10
DEFAULT_NODE_TIMEOUT = 300  # 초


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진 (Gevent 기반)"""

    def __init__(
        self,
        graph: Union[Dict[str, Any], tuple[List[NodeSchema], List[EdgeSchema]]],
        user_input: Dict[str, Any] = None,
        execution_context: Dict[str, Any] = None,
        is_deployed: bool = False,
        db: Optional[Session] = None,
        parent_run_id: Optional[str] = None,
        workflow_timeout: int = 600,
        is_subworkflow: bool = False,
    ):
        """
        WorkflowEngine 초기화

        [GEVENT] asyncio에서 gevent로 전환됨.

        Args:
            graph: 워크플로우 그래프 데이터
            user_input: 사용자가 입력한 변수 값들
            execution_context: 실행 컨텍스트 (user_id 등 전역 환경 정보)
            is_deployed: 배포 모드 여부
            db: DB 세션 (로깅용)
            parent_run_id: 부모 워크플로우의 run_id
            workflow_timeout: 워크플로우 전체 실행 제한 시간 (초)
            is_subworkflow: 서브 워크플로우 여부
        """
        if isinstance(graph, dict):
            nodes = [NodeSchema(**node) for node in graph.get("nodes", [])]
            edges = [EdgeSchema(**edge) for edge in graph.get("edges", [])]

        self.is_deployed = is_deployed
        self.graph = WorkflowGraph(nodes, edges)
        self.node_instances = {}
        self.user_input = user_input if user_input is not None else {}
        self.execution_context = dict(execution_context) if execution_context else {}
        self.workflow_timeout = workflow_timeout
        self.start_time = 0.0

        if db is not None:
            self.execution_context["db"] = db

        self._build_node_instances()

        # 로깅 관련 초기화
        self.logger = WorkflowLogger(db)
        self.parent_run_id = parent_run_id
        self.is_subworkflow = is_subworkflow

        # 그래프 구조 검증
        self.validate_graph()

    @property
    def node_schemas(self) -> Dict[str, NodeSchema]:
        return self.graph.node_schemas

    @property
    def data_dependencies(self) -> Dict[str, set]:
        return self.graph.data_dependencies

    def cleanup(self):
        """실행 완료 후 메모리 정리"""
        for node_instance in self.node_instances.values():
            if (
                hasattr(node_instance, "_subgraph_engine")
                and node_instance._subgraph_engine
            ):
                node_instance._subgraph_engine.cleanup()
                node_instance._subgraph_engine = None

        self.node_instances.clear()
        self.graph.clear()
        self.execution_context = None
        self.user_input = None
        self.logger = None

    def execute(self) -> Dict[str, Any]:
        """
        워크플로우 전체 실행 (Wrapper)

        [GEVENT] 동기 메서드로 변환.
        """
        if self.is_deployed:
            return self.execute_deployed()

        final_context = {}
        for event in self.execute_stream():
            if event["type"] == "workflow_finish":
                final_context = event["data"]
            elif event["type"] == "error":
                raise ValueError(event["data"]["message"])

        return final_context

    def execute_stream(self):
        """
        워크플로우를 실행하고 진행 상황을 제너레이터로 반환합니다.

        [GEVENT] async generator에서 일반 generator로 변환.

        Yields Events:
        - node_start: 노드 실행 시작
        - node_finish: 노드 실행 완료
        - workflow_finish: 전체 워크플로우 완료
        - error: 실행 중 오류 발생
        """
        yield from self._execute_core(stream_mode=True)

    def execute_deployed(self):
        """
        워크플로우 실행 로직 - 배포 모드

        [GEVENT] 동기 메서드로 변환.
        """
        final_result = None
        for event in self._execute_core(stream_mode=False):
            if event["type"] == "workflow_finish":
                final_result = event["data"]

        return final_result

    def _execute_core(self, stream_mode: bool = False):
        """
        핵심 실행 로직 - 스트리밍/배포 모드 공용

        [GEVENT] asyncio에서 gevent로 전환:
        - asyncio.Semaphore → gevent.pool.Pool
        - asyncio.wait() → gevent.joinall() with polling
        - asyncio.create_task() → gevent.spawn()
        - asyncio.Queue → gevent.queue.Queue
        """
        self.start_time = time.time()

        # ============================================================
        # 실행 로그 시작
        # ============================================================
        external_run_id = self.execution_context.get("workflow_run_id")

        if self.is_subworkflow:
            if self.parent_run_id:
                self.logger.workflow_run_id = uuid.UUID(self.parent_run_id)
                self.execution_context["workflow_run_id"] = self.parent_run_id
        elif external_run_id:
            self.logger.workflow_run_id = uuid.UUID(external_run_id)
            # [GEVENT] 직접 동기 호출 (gevent가 I/O를 처리)
            self.logger.create_run_log(
                workflow_id=self.execution_context.get("workflow_id"),
                user_id=self.execution_context.get("user_id"),
                user_input=self.user_input,
                is_deployed=self.is_deployed,
                execution_context=self.execution_context,
                external_run_id=external_run_id,
            )
        elif self.parent_run_id:
            self.logger.workflow_run_id = uuid.UUID(self.parent_run_id)
            self.execution_context["workflow_run_id"] = self.parent_run_id
        else:
            # 새로운 run_id 생성
            workflow_run_id = self.logger.create_run_log(
                workflow_id=self.execution_context.get("workflow_id"),
                user_id=self.execution_context.get("user_id"),
                user_input=self.user_input,
                is_deployed=self.is_deployed,
                execution_context=self.execution_context,
            )

            if workflow_run_id:
                self.execution_context["workflow_run_id"] = str(workflow_run_id)
        # ============================================================

        # [FIX] execution_context를 읽기 전용으로 동결 (greenlet 간 동시 변경 방지)
        self.execution_context = types.MappingProxyType(dict(self.execution_context))

        start_node = self.graph.find_start_node()
        results = {}

        # 병렬 실행 상태 관리
        executed_nodes = set()
        queued_nodes = {start_node}

        # [GEVENT] Greenlet 관리
        running_greenlets = {}  # {greenlet: node_id}

        # [GEVENT] Pool for concurrency control
        pool = Pool(size=MAX_CONCURRENT_NODES)

        # 로그 / Pub/Sub / 스트림 이벤트 발행
        reporter = RunReporter(
            logger=self.logger,
            run_id=self.execution_context.get("workflow_run_id"),
            is_subworkflow=self.is_subworkflow,
            stream_mode=stream_mode,
        )

        try:
            # 워크플로우 시작 이벤트
            if stream_mode:
                yield reporter.workflow_started()

            # 초기 시작 노드 실행
            self._submit_node(start_node, results, running_greenlets, pool, reporter)

            while running_greenlets:
                # 전체 타임아웃 체크
                elapsed_time = time.time() - self.start_time
                if elapsed_time > self.workflow_timeout:
                    for g in running_greenlets:
                        g.kill()

                    error_msg = (
                        f"Workflow timed out after {self.workflow_timeout} seconds."
                    )
                    raise TimeoutError(error_msg)

                # [GEVENT] 이벤트 큐 처리
                yield from reporter.drain_events()

                # [GEVENT] 완료된 greenlet 확인
                completed = []
                for greenlet, node_id in list(running_greenlets.items()):
                    if greenlet.ready():
                        completed.append((greenlet, node_id))

                if not completed:
                    # 대기 중인 greenlet이 없으면 잠시 양보
                    gevent.sleep(0.01)
                    continue

                for greenlet, node_id in completed:
                    del running_greenlets[greenlet]
                    executed_nodes.add(node_id)

                    try:
                        result_data = greenlet.get()
                        node_result = result_data["result"]
                        results[node_id] = node_result

                    except Exception as e:
                        error_event = reporter.node_failed(node_id, str(e))

                        if stream_mode:
                            yield error_event

                        for g in running_greenlets:
                            g.kill()

                        raise e

                    # 다음 실행할 노드 탐색 및 제출
                    next_nodes = self._get_next_nodes(node_id, results[node_id])
                    for next_node_id in next_nodes:
                        if (
                            next_node_id not in executed_nodes
                            and next_node_id not in queued_nodes
                            and next_node_id not in running_greenlets.values()
                            and self._is_ready(next_node_id, results)
                        ):
                            queued_nodes.add(next_node_id)
                            self._submit_node(
                                next_node_id,
                                results,
                                running_greenlets,
                                pool,
                                reporter,
                            )

            # 남은 이벤트 모두 전달
            yield from reporter.drain_events()

            # 워크플로우 종료
            # 스트림 모드는 전체 결과를, 배포 모드는 AnswerNode 결과만 반환
            if stream_mode:
                final_data = dict(results)
            else:
                final_data = self._get_answer_node_result(results)

            yield reporter.workflow_finished(final_data)

        except Exception as e:
            error_event = reporter.workflow_failed(str(e))

            if not stream_mode:
                raise
            yield error_event

    def _submit_node(self, node_id, results, running_greenlets, pool, reporter):
        """
        개별 노드를 실행하기 위해 Greenlet 생성

        [GEVENT] asyncio.create_task() → gevent.spawn()
        """
        if node_id not in self.node_instances:
            raise ValueError(f"노드 ID '{node_id}'를 찾을 수 없습니다.")

        node_instance = self.node_instances[node_id]
        node_schema = self.node_schemas[node_id]

        inputs = self._get_context(node_id, results)

        node_run = reporter.node_started(node_id, node_schema, inputs)

        def _execute_with_event():
            """노드 실행 및 이벤트 발행 래퍼"""
            node_timeout = (
                node_schema.timeout
                if node_schema.timeout is not None
                else DEFAULT_NODE_TIMEOUT
            )

            try:
                # [GEVENT] 타임아웃 적용
                with gevent.Timeout(node_timeout):
                    result = self._execute_node_task(node_instance, node_run, reporter)

            except gevent.Timeout:
                raise TimeoutError(
                    f"Node '{node_id}' ({node_schema.type}) timed out after {node_timeout} seconds."
                )

            reporter.node_finished(node_run, result)

            return {"result": result}

        # [GEVENT] Pool.spawn()으로 Greenlet 생성
        greenlet = pool.spawn(_execute_with_event)
        running_greenlets[greenlet] = node_id

    def _execute_node_task(self, node_instance, node_run: NodeRun, reporter):
        """
        개별 노드를 실행하는 작업

        [GEVENT] 동기 메서드로 변환.
        """
        try:
            # 노드 실행 (핵심) - 동기 실행
            result = node_instance.execute(node_run.inputs)
            reporter.node_log_finished(node_run, result)
            return result

        except Exception as e:
            reporter.node_log_failed(node_run, str(e))
            raise

    # ================================================================
    # 그래프 위임 메서드
    # ================================================================

    def validate_graph(self):
        """워크플로우 그래프의 구조적 유효성을 검사합니다."""
        self.graph.validate()

    def _get_next_nodes(self, node_id: str, result: Dict[str, Any]) -> List[str]:
        """현재 노드의 다음 노드 목록을 반환합니다."""
        return self.graph.get_next_nodes(node_id, result)

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        return self.graph.is_ready(node_id, results)

    # ================================================================
    # 헬퍼 메서드들
    # ================================================================

    def _build_node_instances(self):
        """NodeSchema를 실제 Node 인스턴스로 변환"""
        for node_id, schema in self.node_schemas.items():
            if schema.type == NOTE_TYPE:
                continue

            try:
                self.node_instances[node_id] = NodeFactory.create(
                    schema, context=self.execution_context
                )
            except NotImplementedError as e:
                raise NotImplementedError(
                    f"Cannot create node '{node_id}': {str(e)}"
                ) from e

    def _get_context(self, node_id: str, results: Dict) -> Dict[str, Any]:
        """현재 노드가 실행에 필요한 모든 입력 데이터를 구성"""
        if self.graph.is_trigger(node_id):
            return self.user_input

        return dict(results)

    def _get_answer_node_result(self, results: Dict) -> Dict[str, Any]:
        """배포 모드에서 AnswerNode의 결과만 추출하여 반환합니다."""
        answer_nodes = self.graph.nodes_by_type.get("answerNode", [])

        for node_id in answer_nodes:
            if node_id in results:
                return results[node_id]
