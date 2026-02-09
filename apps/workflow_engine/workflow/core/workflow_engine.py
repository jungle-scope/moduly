"""
WorkflowEngine - Gevent-based Workflow Execution Engine

[GEVENT] Migrated from asyncio to gevent for Celery gevent pool compatibility.
"""

import time
import uuid
from typing import Any, Dict, List, Optional, Union

import gevent
from gevent.pool import Pool
from gevent.queue import Queue
from sqlalchemy.orm import Session

from apps.shared.pubsub import publish_workflow_event  # [GEVENT] Use sync version
from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.workflow_logger import WorkflowLogger
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory


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
        self.node_schemas = {node.id: node for node in nodes}
        self.node_instances = {}
        self.edges = edges
        self.user_input = user_input if user_input is not None else {}
        self.execution_context = dict(execution_context) if execution_context else {}
        self.workflow_timeout = workflow_timeout
        self.start_time = 0.0

        if db is not None:
            self.execution_context["db"] = db
        elif "db" not in self.execution_context:
            pass

        # [PERF] 그래프 구조 사전 계산
        self.adjacency_list = {}
        self.reverse_graph = {}
        self.edge_handles = {}
        self.data_dependencies = {}
        self._build_optimized_graph()

        # 타입별 노드 인덱스
        self.nodes_by_type = {}
        for node_id, schema in self.node_schemas.items():
            if schema.type not in self.nodes_by_type:
                self.nodes_by_type[schema.type] = []
            self.nodes_by_type[schema.type].append(node_id)

        self._build_node_instances()

        # 로깅 관련 초기화
        self.logger = WorkflowLogger(db)
        self.parent_run_id = parent_run_id
        self.start_node_id = None
        self.is_subworkflow = is_subworkflow

        # 그래프 구조 검증
        self.validate_graph()

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
        self.node_schemas.clear()
        self.adjacency_list.clear()
        self.reverse_graph.clear()
        self.edge_handles.clear()
        self.nodes_by_type.clear()
        self.execution_context.clear()
        self.user_input = None
        self.logger = None
        self.edges = None

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
        for event in self._execute_core(stream_mode=True):
            yield event

    def execute_deployed(self):
        """
        워크플로우 실행 로직 - 배포 모드

        [GEVENT] 동기 메서드로 변환.
        """
        final_result = None
        try:
            for event in self._execute_core(stream_mode=False):
                if event["type"] == "workflow_finish":
                    final_result = event["data"]
        except Exception as e:
            raise e

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

        start_node = self._find_start_node()
        results = {}

        # 병렬 실행 상태 관리
        executed_nodes = set()
        queued_nodes = {start_node}

        # [GEVENT] Greenlet 관리
        running_greenlets = {}  # {greenlet: node_id}

        # [GEVENT] Pool for concurrency control
        max_concurrent_tasks = 10
        pool = Pool(size=max_concurrent_tasks)

        # [GEVENT] 이벤트 큐
        event_queue = Queue() if stream_mode else None

        try:
            # 워크플로우 시작 이벤트
            if stream_mode:
                yield {"type": "workflow_start", "data": {}}

            # 초기 시작 노드 실행
            self._submit_node(
                start_node,
                results,
                running_greenlets,
                stream_mode,
                pool,
                event_queue,
            )

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
                if stream_mode and event_queue:
                    while not event_queue.empty():
                        try:
                            event = event_queue.get_nowait()
                            yield event
                        except Exception:
                            break

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
                        error_msg = str(e)
                        self.logger.update_run_log_error(error_msg)

                        if stream_mode:
                            yield {
                                "type": "error",
                                "data": {"node_id": node_id, "message": error_msg},
                            }

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
                                stream_mode,
                                pool,
                                event_queue,
                            )

            # 남은 이벤트 모두 전달
            if stream_mode and event_queue:
                while not event_queue.empty():
                    try:
                        event = event_queue.get_nowait()
                        yield event
                    except Exception:
                        break

            # 워크플로우 종료
            run_id = self.execution_context.get("workflow_run_id")
            if stream_mode:
                final_context = dict(results)
                if not self.is_subworkflow:
                    self.logger.update_run_log_finish(final_context)
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "workflow_finish", final_context)
                yield {"type": "workflow_finish", "data": final_context}
            else:
                final_result = self._get_answer_node_result(results)
                if not self.is_subworkflow:
                    self.logger.update_run_log_finish(final_result)
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "workflow_finish", final_result)
                yield {"type": "workflow_finish", "data": final_result}

        except Exception as e:
            run_id = self.execution_context.get("workflow_run_id")
            if not stream_mode:
                if not self.is_subworkflow:
                    self.logger.update_run_log_error(str(e))
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "error", {"message": str(e)})
                raise e
            else:
                error_msg = str(e)
                if not self.is_subworkflow:
                    self.logger.update_run_log_error(error_msg)
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "error", {"message": error_msg})
                yield {"type": "error", "data": {"message": error_msg}}

    def _submit_node(
        self, node_id, results, running_greenlets, stream_mode, pool, event_queue
    ):
        """
        개별 노드를 실행하기 위해 Greenlet 생성

        [GEVENT] asyncio.create_task() → gevent.spawn()
        """
        if node_id not in self.node_instances:
            raise ValueError(f"노드 ID '{node_id}'를 찾을 수 없습니다.")

        node_instance = self.node_instances[node_id]
        node_schema = self.node_schemas[node_id]

        inputs = self._get_context(node_id, results)

        from datetime import datetime, timezone

        started_at = datetime.now(timezone.utc)

        node_options_snapshot = None
        log_id = None

        if not self.is_subworkflow:
            node_options_snapshot = self._extract_node_options(node_schema)
            log_id = self.logger.create_node_log(
                node_id,
                node_schema.type,
                inputs,
                process_data=node_options_snapshot,
            )

        # Redis Pub/Sub 이벤트 발행
        run_id = self.execution_context.get("workflow_run_id")
        if run_id and not self.is_subworkflow:
            publish_workflow_event(
                run_id,
                "node_start",
                {
                    "node_id": node_id,
                    "node_type": node_schema.type,
                },
            )

        if stream_mode and event_queue:
            event_queue.put(
                {
                    "type": "node_start",
                    "data": {"node_id": node_id, "node_type": node_schema.type},
                }
            )

        def _execute_with_event():
            """노드 실행 및 이벤트 발행 래퍼"""
            node_timeout = (
                node_schema.timeout if node_schema.timeout is not None else 300
            )

            try:
                # [GEVENT] 타임아웃 적용
                with gevent.Timeout(node_timeout):
                    result = self._execute_node_task(
                        node_id,
                        node_schema,
                        node_instance,
                        inputs,
                        log_id,
                        node_options_snapshot,
                        started_at,
                    )

            except gevent.Timeout:
                raise TimeoutError(
                    f"Node '{node_id}' ({node_schema.type}) timed out after {node_timeout} seconds."
                )

            # node_finish 이벤트 발행
            run_id = self.execution_context.get("workflow_run_id")
            if run_id and not self.is_subworkflow:
                publish_workflow_event(
                    run_id,
                    "node_finish",
                    {
                        "node_id": node_id,
                        "node_type": node_schema.type,
                        "output": result,
                    },
                )

            if stream_mode and event_queue:
                event_queue.put(
                    {
                        "type": "node_finish",
                        "data": {
                            "node_id": node_id,
                            "node_type": node_schema.type,
                            "output": result,
                        },
                    }
                )

            return {"result": result}

        # [GEVENT] Pool.spawn()으로 Greenlet 생성
        greenlet = pool.spawn(_execute_with_event)
        running_greenlets[greenlet] = node_id

    def _execute_node_task(
        self,
        node_id,
        node_schema,
        node_instance,
        inputs,
        log_id=None,
        node_options_snapshot=None,
        started_at=None,
    ):
        """
        개별 노드를 실행하는 작업

        [GEVENT] 동기 메서드로 변환.
        """
        try:
            # 노드 실행 (핵심) - 동기 실행
            result = node_instance.execute(inputs)

            # 노드 완료 로깅
            if not self.is_subworkflow:
                self.logger.update_node_log_finish(
                    log_id,
                    node_id,
                    result,
                    node_type=node_schema.type,
                    inputs=inputs,
                    process_data=node_options_snapshot,
                    started_at=started_at,
                )

            return result

        except Exception as e:
            error_msg = str(e)
            if not self.is_subworkflow:
                self.logger.update_node_log_error(
                    log_id,
                    node_id,
                    error_msg,
                    node_type=node_schema.type,
                    inputs=inputs,
                    process_data=node_options_snapshot,
                    started_at=started_at,
                )
            raise e

    # ================================================================
    # 그래프 검증 메서드
    # ================================================================

    def validate_graph(self):
        """워크플로우 그래프의 구조적 유효성을 검사합니다."""
        self._check_cycles()
        self._check_start_nodes()
        self._check_isolation()

    def _check_cycles(self):
        """DFS를 사용하여 그래프 내 순환(Cycle)을 감지합니다."""
        visited = set()
        recursion_stack = set()

        for node_id in self.node_schemas:
            if node_id not in visited:
                if self._detect_cycle_dfs(node_id, visited, recursion_stack):
                    raise ValueError(
                        f"워크플로우에 순환(Cycle)이 감지되었습니다. 노드 ID: {node_id}"
                    )

    def _detect_cycle_dfs(self, node_id, visited, recursion_stack):
        """순환 감지를 위한 DFS 재귀 함수"""
        visited.add(node_id)
        recursion_stack.add(node_id)

        for neighbor in self.adjacency_list.get(node_id, []):
            if neighbor not in visited:
                if self._detect_cycle_dfs(neighbor, visited, recursion_stack):
                    return True
            elif neighbor in recursion_stack:
                return True

        recursion_stack.remove(node_id)
        return False

    def _check_start_nodes(self):
        """시작 노드 유효성 검사 및 ID 캐싱"""
        start_nodes = []
        TRIGGER_TYPES = ["startNode", "webhookTrigger", "scheduleTrigger"]

        for node_id, node in self.node_schemas.items():
            if node.type in TRIGGER_TYPES:
                start_nodes.append(node_id)

        if len(start_nodes) > 1:
            raise ValueError(
                f"워크플로우에 시작 노드가 {len(start_nodes)}개 있습니다. 시작 노드는 1개만 있어야 합니다."
            )
        elif len(start_nodes) == 0:
            raise ValueError(
                "워크플로우에 시작 노드(type='startNode' or 'webhookTrigger')가 없습니다."
            )

        self.start_node_id = start_nodes[0]

    def _check_isolation(self):
        """시작 노드에서 도달 불가능한 고립 노드가 있는지 검사합니다."""
        start_node_id = self._find_start_node()
        visited = {start_node_id}
        queue = [start_node_id]

        while queue:
            current_node = queue.pop(0)
            neighbors = self.adjacency_list.get(current_node, [])
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        all_nodes = set(self.node_schemas.keys())
        valid_nodes = {
            node_id
            for node_id in all_nodes
            if self.node_schemas[node_id].type != "note"
        }

        isolated_nodes = valid_nodes - visited

        if isolated_nodes:
            raise ValueError(
                f"시작 노드에서 도달할 수 없는 고립된 노드가 발견되었습니다. "
                f"노드 IDs: {list(isolated_nodes)}"
            )

    # ================================================================
    # 헬퍼 메서드들
    # ================================================================

    def _find_start_node(self) -> str:
        """시작 노드 찾기"""
        if self.start_node_id is None:
            raise ValueError(
                "시작 노드가 설정되지 않았습니다. validate_graph()를 먼저 호출해주세요."
            )
        return self.start_node_id

    def _get_next_nodes(self, node_id: str, result: Dict[str, Any]) -> List[str]:
        """현재 노드의 다음 노드 목록을 반환합니다."""
        selected_handle = result.get("selected_handle")

        if selected_handle is not None:
            key = (node_id, selected_handle)
            next_nodes = self.edge_handles.get(key, [])
            return next_nodes

        return self.adjacency_list.get(node_id, [])

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        if node_id in self.data_dependencies:
            required_inputs = self.data_dependencies[node_id]
        else:
            required_inputs = self.reverse_graph.get(node_id, [])

        return all(inp in results for inp in required_inputs)

    def _build_optimized_graph(self):
        """엣지를 분석하여 효율적인 그래프 구조 생성"""
        for edge in self.edges:
            if edge.source not in self.adjacency_list:
                self.adjacency_list[edge.source] = []
            self.adjacency_list[edge.source].append(edge.target)

            if edge.target not in self.reverse_graph:
                self.reverse_graph[edge.target] = []
            self.reverse_graph[edge.target].append(edge.source)

            key = (edge.source, edge.sourceHandle)
            if key not in self.edge_handles:
                self.edge_handles[key] = []
            self.edge_handles[key].append(edge.target)

        self._analyze_data_dependencies()

    def _build_node_instances(self):
        """NodeSchema를 실제 Node 인스턴스로 변환"""
        for node_id, schema in self.node_schemas.items():
            if schema.type == "note":
                continue

            try:
                self.node_instances[node_id] = NodeFactory.create(
                    schema, context=self.execution_context
                )
            except NotImplementedError as e:
                raise NotImplementedError(
                    f"Cannot create node '{node_id}': {str(e)}"
                ) from e

    def _analyze_data_dependencies(self):
        """각 노드의 value_selector를 분석하여 실제 데이터 의존성을 추출합니다."""
        for node_id, schema in self.node_schemas.items():
            if schema.type in ["startNode", "webhookTrigger", "scheduleTrigger"]:
                self.data_dependencies[node_id] = set()
                continue

            referenced_nodes = self._extract_value_selectors(schema)

            if referenced_nodes:
                self.data_dependencies[node_id] = referenced_nodes
            else:
                self.data_dependencies[node_id] = set()

    def _extract_value_selectors(self, schema: NodeSchema) -> set:
        """NodeSchema의 data에서 모든 value_selector를 추출합니다."""
        referenced_nodes = set()

        if not schema.data:
            return referenced_nodes

        data_dict = schema.data if isinstance(schema.data, dict) else schema.data.dict()

        def extract_from_value(value):
            if isinstance(value, dict):
                if "value_selector" in value:
                    selector = value["value_selector"]
                    if isinstance(selector, list) and len(selector) > 0:
                        node_id = selector[0]
                        if isinstance(node_id, str) and node_id in self.node_schemas:
                            referenced_nodes.add(node_id)

                for v in value.values():
                    extract_from_value(v)

            elif isinstance(value, list):
                for item in value:
                    extract_from_value(item)

        extract_from_value(data_dict)
        return referenced_nodes

    def _get_context(self, node_id: str, results: Dict) -> Dict[str, Any]:
        """현재 노드가 실행에 필요한 모든 입력 데이터를 구성"""
        node_schema = self.node_schemas.get(node_id)
        if node_schema and node_schema.type in [
            "startNode",
            "webhookTrigger",
            "scheduleTrigger",
        ]:
            return self.user_input

        return dict(results)

    def _get_answer_node_result(self, results: Dict) -> Dict[str, Any]:
        """배포 모드에서 AnswerNode의 결과만 추출하여 반환합니다."""
        answer_nodes = self.nodes_by_type.get("answerNode", [])

        for node_id in answer_nodes:
            if node_id in results:
                return results[node_id]

    def _extract_node_options(self, node_schema) -> Dict[str, Any]:
        """노드 설정을 process_data용 스냅샷으로 추출합니다."""
        try:
            data = dict(node_schema.data) if node_schema.data else {}

            return {
                "node_options": data,
                "node_title": data.get("title", ""),
            }
        except Exception:
            return {}
