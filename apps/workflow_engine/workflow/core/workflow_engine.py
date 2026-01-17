import asyncio
import uuid
from typing import Any, Dict, List, Optional, Union

from sqlalchemy.orm import Session

from apps.shared.pubsub import publish_workflow_event  # [NEW] Redis Pub/Sub
from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.workflow_logger import (
    WorkflowLogger,  # [NEW] 로깅 유틸리티
)
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진 (AsyncIO 기반)"""

    def __init__(
        self,
        graph: Union[Dict[str, Any], tuple[List[NodeSchema], List[EdgeSchema]]],
        user_input: Dict[str, Any] = None,
        execution_context: Dict[str, Any] = None,
        is_deployed: bool = False,
        db: Optional[Session] = None,  # [NEW] DB 세션 주입 (로깅용)
        parent_run_id: Optional[str] = None,  # [NEW] 서브 워크플로우용 부모 run_id
        workflow_timeout: int = 600,  # [NEW] 전체 워크플로우 타임아웃 (기본 10분)
        is_subworkflow: bool = False,  # [NEW] 서브 워크플로우 여부 (Redis 이벤트 발행 스킵)
    ):
        """
        WorkflowEngine 초기화


        Args:
            graph: 워크플로우 그래프 데이터
                - Dict 형태: {"nodes": [...], "edges": [...], "viewport": ...}
            user_input: 사용자가 입력한 변수 값들
            execution_context: 실행 컨텍스트 (user_id 등 전역 환경 정보)
            is_deployed: 배포 모드 여부 (True: 배포된 워크플로우, False: Draft)
            db: DB 세션 (로깅용) # [NEW]
            parent_run_id: 부모 워크플로우의 run_id (서브 워크플로우 실행 시 사용)
            workflow_timeout: 워크플로우 전체 실행 제한 시간 (초 단위, 기본 600초)
        """
        # graph가 딕셔너리인 경우 nodes와 edges 추출
        if isinstance(graph, dict):
            nodes = [NodeSchema(**node) for node in graph.get("nodes", [])]
            edges = [EdgeSchema(**edge) for edge in graph.get("edges", [])]

        self.is_deployed = is_deployed  # 배포 모드 플래그
        self.node_schemas = {node.id: node for node in nodes}  # Schema 보관
        self.node_instances = {}  # Node 인스턴스 저장
        self.edges = edges
        self.user_input = user_input if user_input is not None else {}
        # 외부에서 전달된 dict를 직접 수정하지 않도록 복사본 사용
        self.execution_context = dict(execution_context or {})
        self.workflow_timeout = workflow_timeout  # [NEW] 전체 타임아웃 설정
        self.start_time = 0.0  # [NEW] 실행 시작 시간

        # [FIX] DB 세션을 execution_context에 주입 (WorkflowNode 등에서 사용)
        if db is not None:
            self.execution_context["db"] = db

        # [PERF] 그래프 구조 사전 계산
        self.adjacency_list = {}  # source -> [targets]
        self.reverse_graph = {}  # target -> [sources]
        self.edge_handles = {}  # (source, handle) -> [targets]
        self._build_optimized_graph()

        # [PERF] 타입별 노드 인덱스 (answerNode 등 빠른 조회를 위해)
        self.nodes_by_type = {}
        for node_id, schema in self.node_schemas.items():
            if schema.type not in self.nodes_by_type:
                self.nodes_by_type[schema.type] = []
            self.nodes_by_type[schema.type].append(node_id)

        self._build_node_instances()  # Schema → Node 변환

        # ============================================================
        # [NEW SECTION] 모니터링/로깅 관련 초기화
        # ============================================================
        self.logger = WorkflowLogger(db)  # 로깅 유틸리티 인스턴스
        self.parent_run_id = parent_run_id  # 서브 워크플로우용 부모 run_id
        self.start_node_id = None  # [NEW] 시작 노드 ID 캐싱
        self.is_subworkflow = is_subworkflow  # [NEW] 서브 워크플로우 여부

        # [VALIDATION] 그래프 구조 검증 (순환, 시작 노드 등)
        self.validate_graph()

    def cleanup(self):
        """
        실행 완료 후 메모리 정리

        [FIX] 메모리 누수 방지를 위해 모든 참조를 명시적으로 정리합니다.
        Celery 태스크에서 finally 블록에서 호출되어야 합니다.
        """
        # [FIX] 노드 인스턴스 내부의 서브그래프 엔진도 정리 (LoopNode 등)
        for node_instance in self.node_instances.values():
            if (
                hasattr(node_instance, "_subgraph_engine")
                and node_instance._subgraph_engine
            ):
                node_instance._subgraph_engine.cleanup()
                node_instance._subgraph_engine = None

        # 노드 관련 정리
        self.node_instances.clear()
        self.node_schemas.clear()

        # 그래프 구조 정리
        self.adjacency_list.clear()
        self.reverse_graph.clear()
        self.edge_handles.clear()
        self.nodes_by_type.clear()

        # 컨텍스트 정리
        self.execution_context.clear()
        self.user_input = None

        # 로거 정리
        self.logger = None

        # 엣지 정리
        self.edges = None

    async def execute(self) -> Dict[str, Any]:
        """
        워크플로우 전체 실행 (Wrapper)
        execute_stream을 호출하여 실행하고, 최종 결과만 반환합니다.
        """
        if self.is_deployed:
            return await self.execute_deployed()

        final_context = {}
        async for event in self.execute_stream():
            if event["type"] == "workflow_finish":
                final_context = event["data"]
            elif event["type"] == "error":
                raise ValueError(event["data"]["message"])

        return final_context

    async def execute_stream(self):
        """
        워크플로우를 실행하고 진행 상황을 제너레이터로 반환합니다. (SSE 스트리밍용)
        각 실행 단계마다 이벤트를 yield하여 클라이언트가 실시간으로 상태를 알 수 있게 합니다.

        Yields Events:
        - node_start: 노드 실행 시작
        - node_finish: 노드 실행 완료 (결과 포함)
        - workflow_finish: 전체 워크플로우 완료
        - error: 실행 중 오류 발생
        """
        async for event in self._execute_core(stream_mode=True):
            yield event

    async def execute_deployed(self):
        """
        워크플로우 실행 로직
        streaming이 필요 없는 배포된 workflow를 실행할 때 사용합니다.
        """
        # _execute_core는 제너레이터이므로, 값을 반환받으려면 StopAsyncIteration의 value를 가져와야 할 수도 있지만
        # python async generator는 return 값을 가질 수 없음 (Python 3.6+).
        # 대신 _execute_core 안에서 return 하는 것이 아니라, 마지막에 결과를 반환하도록 구조를 잡아야 함.
        # 하지만 여기서는 async for 루프를 돌면서 결과를 수집하는 방식으로 구현.

        # NOTE: async generator는 return 값을 가질 수 없음. 따라서 예외 처리로 값을 전달하거나,
        # _execute_core가 마지막에 특정 이벤트를 yield하고 종료하도록 해야 함.
        # 여기서는 _execute_core가 stream_mode=False일 때도 workflow_finish 이벤트를 주도록 하거나
        # 별도 로직을 분리해야 함.

        # 리팩토링: _execute_core는 항상 이벤트를 yield하도록 하고, 여기서 처리.
        final_result = None
        try:
            async for event in self._execute_core(stream_mode=False):
                if event["type"] == "workflow_finish":
                    final_result = event["data"]
                # 배포 모드에서는 중간 이벤트 무시 (에러 제외)
        except Exception as e:
            raise e

        return final_result

    async def _execute_core(self, stream_mode: bool = False):
        """
        핵심 실행 로직 - 스트리밍/배포 모드 공용
        [성능 개선] AsyncIO를 이용한 비동기/병렬 실행
        [실시간 스트리밍] asyncio.Queue를 사용하여 node_start/node_finish 이벤트 즉시 전달
        [일정] 타임아웃 체크 로직 추가
        """
        import time  # 타임아웃 체크용

        self.start_time = time.time()  # 실행 시작 시간 기록
        # ============================================================
        # [NEW] 실행 로그 시작
        # ============================================================
        # 외부에서 전달된 run_id가 있으면 사용 (Gateway에서 미리 생성한 경우)
        external_run_id = self.execution_context.get("workflow_run_id")

        # [FIX] 서브 워크플로우인 경우 run_id 생성/로깅 스킵
        if self.is_subworkflow:
            # 서브 워크플로우는 부모의 run_id만 참조, DB에 별도 run 레코드 생성하지 않음
            if self.parent_run_id:
                self.logger.workflow_run_id = uuid.UUID(self.parent_run_id)
                self.execution_context["workflow_run_id"] = self.parent_run_id
            print(
                f"[WorkflowEngine] 서브 워크플로우 실행 - parent_run_id: {self.parent_run_id}"
            )
        elif external_run_id:
            # 외부 run_id 사용 (Gateway → Celery → WorkflowEngine)
            self.logger.workflow_run_id = uuid.UUID(external_run_id)
            # create_run_log 호출하여 DB에 기록 (run_id 전달)
            self.logger.create_run_log(
                workflow_id=self.execution_context.get("workflow_id"),
                user_id=self.execution_context.get("user_id"),
                user_input=self.user_input,
                is_deployed=self.is_deployed,
                execution_context=self.execution_context,
                external_run_id=external_run_id,  # [NEW] 외부 run_id 전달
            )
            print(f"[WorkflowEngine] 외부 run_id 사용: {external_run_id}")
        elif self.parent_run_id:
            # 서브 워크플로우인 경우 부모의 run_id를 재사용 (레거시 지원)
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

        # AsyncIO Task 관리
        # running_tasks: {Task: node_id}
        running_tasks = {}

        # Max Workers (AsyncIO Semaphore로 제어)
        max_concurrent_tasks = 10
        semaphore = asyncio.Semaphore(max_concurrent_tasks)

        # [실시간 스트리밍] 이벤트 큐 생성 - node_start/node_finish 이벤트를 즉시 전달하기 위함
        event_queue: asyncio.Queue = asyncio.Queue() if stream_mode else None

        try:
            # 1. 워크플로우 시작 이벤트 (스트림 모드만)
            if stream_mode:
                yield {"type": "workflow_start", "data": {}}

            # 초기 시작 노드 실행 태스크 생성
            await self._submit_node(
                start_node, results, running_tasks, stream_mode, semaphore, event_queue
            )

            while running_tasks:
                # [NEW] 전체 타임아웃 체크
                elapsed_time = time.time() - self.start_time
                if elapsed_time > self.workflow_timeout:
                    # 모든 실행 중인 태스크 취소
                    for t in running_tasks:
                        t.cancel()

                    error_msg = (
                        f"Workflow timed out after {self.workflow_timeout} seconds."
                    )
                    raise TimeoutError(error_msg)

                # [실시간 스트리밍] 이벤트 큐에서 대기 중인 이벤트를 먼저 모두 전달
                if stream_mode and event_queue:
                    while not event_queue.empty():
                        event = event_queue.get_nowait()
                        yield event

                # 완료된 작업 대기 (짧은 타임아웃으로 이벤트 큐도 주기적으로 확인)
                # asyncio.wait는 (done, pending) 튜플 반환
                try:
                    done, _ = await asyncio.wait(
                        running_tasks.keys(),
                        timeout=0.05
                        if stream_mode
                        else None,  # 스트림 모드: 50ms 타임아웃으로 이벤트 큐 확인
                        return_when=asyncio.FIRST_COMPLETED,
                    )
                except asyncio.CancelledError:
                    raise

                # 타임아웃으로 done이 비어있을 수 있음 (스트림 모드에서 이벤트 처리용)
                if not done:
                    continue

                for task in done:
                    node_id = running_tasks.pop(task)
                    executed_nodes.add(node_id)

                    try:
                        # 실행 결과 가져오기 (예외 발생 시 여기서 raise됨)
                        result_data = task.result()
                        node_result = result_data["result"]

                        # 결과 저장
                        results[node_id] = node_result

                    except Exception as e:
                        # 에러 처리
                        error_msg = str(e)
                        self.logger.update_run_log_error(error_msg)

                        if stream_mode:
                            yield {
                                "type": "error",
                                "data": {"node_id": node_id, "message": error_msg},
                            }

                        # 실행 중인 모든 태스크 취소
                        for t in running_tasks:
                            t.cancel()

                        raise e  # 즉시 중단

                    # 다음 실행할 노드 탐색 및 제출
                    next_nodes = self._get_next_nodes(node_id, results[node_id])
                    for next_node_id in next_nodes:
                        # 아직 실행 안됐고, 큐에 없고, 현재 실행 중이지 않으며, 모든 선행 노드가 완료되었으면 실행
                        if (
                            next_node_id not in executed_nodes
                            and next_node_id not in queued_nodes
                            and next_node_id not in running_tasks.values()
                            and self._is_ready(next_node_id, results)
                        ):
                            queued_nodes.add(next_node_id)
                            await self._submit_node(
                                next_node_id,
                                results,
                                running_tasks,
                                stream_mode,
                                semaphore,
                                event_queue,
                            )

            # [실시간 스트리밍] 남은 이벤트 모두 전달
            if stream_mode and event_queue:
                while not event_queue.empty():
                    event = event_queue.get_nowait()
                    yield event

            # 4. 워크플로우 종료
            run_id = self.execution_context.get("workflow_run_id")
            if stream_mode:
                final_context = dict(results)
                if not self.is_subworkflow:
                    self.logger.update_run_log_finish(final_context)
                # [FIX] 서브 워크플로우에서는 Redis 이벤트 발행 스킵 (조기 종료 방지)
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "workflow_finish", final_context)
                yield {"type": "workflow_finish", "data": final_context}
            else:
                final_result = self._get_answer_node_result(results)
                if not self.is_subworkflow:
                    self.logger.update_run_log_finish(final_result)
                # [FIX] 서브 워크플로우에서는 Redis 이벤트 발행 스킵
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "workflow_finish", final_result)
                # 배포 모드에서도 결과 전달을 위해 이벤트 사용
                yield {"type": "workflow_finish", "data": final_result}

        except Exception as e:
            run_id = self.execution_context.get("workflow_run_id")
            if not stream_mode:
                if not self.is_subworkflow:
                    self.logger.update_run_log_error(str(e))
                # [FIX] 서브 워크플로우에서는 Redis 이벤트 발행 스킵
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "error", {"message": str(e)})
                raise e
            else:
                error_msg = str(e)
                if not self.is_subworkflow:
                    self.logger.update_run_log_error(error_msg)
                # [FIX] 서브 워크플로우에서는 Redis 이벤트 발행 스킵
                if run_id and not self.is_subworkflow:
                    publish_workflow_event(run_id, "error", {"message": error_msg})
                yield {"type": "error", "data": {"message": error_msg}}
        # 참고: self.logger.shutdown() 호출 제거됨
        # 이제 공유 LogWorkerPool을 사용하므로 인스턴스별 종료 불필요
        # 풀은 앱 종료 시 shutdown_log_worker_pool()으로 종료됨

    async def _submit_node(
        self, node_id, results, running_tasks, stream_mode, semaphore, event_queue
    ):
        """
        개별 노드를 실행하기 위해 AsyncIO Task 생성
        [실시간 스트리밍] node_start 이벤트를 즉시 전송
        """
        # node_id 검증
        if node_id not in self.node_instances:
            raise ValueError(f"노드 ID '{node_id}'를 찾을 수 없습니다.")

        node_instance = self.node_instances[node_id]
        node_schema = self.node_schemas[node_id]

        # 컨텍스트 복사 (스레드 안전성 보장 필요 시)
        inputs = self._get_context(node_id, results)

        # [실시간 스트리밍] node_start 이벤트를 Task 생성 시점(실행 시작 전)에 즉시 전송
        # [FIX] 서브 워크플로우에서는 노드 로깅도 스킵 (UI 간섭 방지)
        if not self.is_subworkflow:
            # [NEW] 노드 옵션 스냅샷 추출 (실행 시점 설정 기록용)
            node_options_snapshot = self._extract_node_options(node_schema)
            self.logger.create_node_log(
                node_id,
                node_schema.type,
                inputs,
                process_data=node_options_snapshot,
            )

        # [FIX] Redis Pub/Sub으로 이벤트 발행 (run_id가 있고 서브워크플로우가 아닐 경우)
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
            await event_queue.put(
                {
                    "type": "node_start",
                    "data": {"node_id": node_id, "node_type": node_schema.type},
                }
            )

        async def _task_wrapper():
            async with semaphore:
                loop = asyncio.get_running_loop()
                # 동기 노드 실행을 스레드 풀에서 실행하여 이벤트 루프 블로킹 방지
                return await loop.run_in_executor(
                    None,
                    self._execute_node_task_sync,
                    node_id,
                    node_schema,
                    node_instance,
                    inputs,
                )

        # [NEW] 노드별 타임아웃 적용 (asyncio.wait_for)
        # 우선순위: 1. 노드 설정(node_schema.timeout) > 2. 기본값(300초)
        node_timeout = node_schema.timeout if node_schema.timeout is not None else 300

        # [실시간 스트리밍] node_finish 이벤트를 완료 시점에 즉시 전송하는 래퍼
        async def _task_wrapper_with_event():
            try:
                # [TIMEOUT] 노드 실행 타임아웃 적용
                result = await asyncio.wait_for(_task_wrapper(), timeout=node_timeout)
            except asyncio.TimeoutError:
                raise TimeoutError(
                    f"Node '{node_id}' ({node_schema.type}) timed out after {node_timeout} seconds."
                )

            # [FIX] Redis Pub/Sub으로 node_finish 이벤트 발행 (run_id가 있고 서브워크플로우가 아닐 경우)
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

            # node_finish 이벤트를 즉시 큐에 전송
            if stream_mode and event_queue:
                await event_queue.put(
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

        # Task 생성 및 등록
        task = asyncio.create_task(_task_wrapper_with_event())
        running_tasks[task] = node_id

    def _execute_node_task_sync(self, node_id, node_schema, node_instance, inputs):
        """
        개별 노드를 실행하는 작업 (Worker Thread에서 실행됨)
        [실시간 스트리밍] 이벤트는 _submit_node에서 처리하므로 결과만 반환
        반환값: 노드 실행 결과 (Dict)
        """
        try:
            # 노드 실행 (핵심) - 동기 실행
            result = node_instance.execute(inputs)

            # 노드 완료 로깅 (서브 워크플로우에서는 스킵)
            if not self.is_subworkflow:
                self.logger.update_node_log_finish(node_id, result)

            return result

        except Exception as e:
            error_msg = str(e)
            if not self.is_subworkflow:
                self.logger.update_node_log_error(node_id, error_msg)
            raise e

    # ================================================================
    # [NEW] 그래프 검증 메서드
    # ================================================================

    def validate_graph(self):
        """
        워크플로우 그래프의 구조적 유효성을 검사합니다.
        1. 순환(Cycle) 여부 검사
        2. 시작 노드 개수 검사 (0개 또는 2개 이상이면 에러)
        3. 도달 불가능한 고립 노드 검사
        """
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

        # 인접 노드 탐색
        for neighbor in self.adjacency_list.get(node_id, []):
            if neighbor not in visited:
                if self._detect_cycle_dfs(neighbor, visited, recursion_stack):
                    return True
            elif neighbor in recursion_stack:
                return True

        recursion_stack.remove(node_id)
        return False

    def _check_start_nodes(self):
        """시작 노드 유효성 검사 (0개 또는 2개 이상 불가) 및 ID 캐싱"""
        start_nodes = []

        # Trigger 노드 타입 정의
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

        # [NEW] 시작 노드 ID 캐싱
        self.start_node_id = start_nodes[0]

    def _check_isolation(self):
        """
        시작 노드에서 도달 불가능한 고립(Isolated) 노드가 있는지 검사합니다.
        BFS를 사용하여 도달 가능한 모든 노드를 탐색하고, 전체 노드와 비교합니다.
        """
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

        # 전체 노드 집합
        all_nodes = set(self.node_schemas.keys())

        # 주석/메모 노드 제 (선택 사항이지만 보통 메모는 실행 흐름과 무관)
        # 만약 note 타입이 node_schemas에 포함된다면 제외해야 함.
        # 여기서는 self._build_node_instances에서 note 타입을 건너뛰지만,
        # node_schemas에는 포함되어 있을 수 있음.
        valid_nodes = {
            node_id
            for node_id in all_nodes
            if self.node_schemas[node_id].type != "note"
        }

        # 고립된 노드 식별 (도달 불가능한 노드)
        isolated_nodes = valid_nodes - visited

        if isolated_nodes:
            raise ValueError(
                f"시작 노드에서 도달할 수 없는 고립된 노드가 발견되었습니다. "
                f"노드 IDs: {list(isolated_nodes)}"
            )

    # ================================================================
    # 기존 헬퍼 메서드들 (변경 없음)
    # ================================================================

    def _find_start_node(self) -> str:
        """
        시작 노드 찾기
        validate_graph()에서 이미 검증되고 self.start_node_id에 캐싱되었으므로 바로 반환
        """
        if self.start_node_id is None:
            # 혹시 모를 예외 상황 (validate_graph가 호출되지 않았거나 로직 오류)
            raise ValueError(
                "시작 노드가 설정되지 않았습니다. validate_graph()를 먼저 호출해주세요."
            )

        return self.start_node_id

    def _get_next_nodes(self, node_id: str, result: Dict[str, Any]) -> List[str]:
        """
        현재 노드의 다음 노드 목록을 반환합니다.

        동작 방식:
        1. selected_handle is None (기본 동작):
           - "특정 경로를 선택하지 않음"을 의미합니다.
           - 연결된 모든 엣지를 따라 다음 노드들을 실행합니다. (Parallel 실행 가능)
           - [PERF] 미리 구축된 self.graph를 사용하여 O(1) 조회

        2. selected_handle has value (분기 동작):
           - "특정 핸들(경로)만 선택함"을 의미합니다.
           - 엣지의 sourceHandle이 selected_handle과 일치하는 경우에만 실행합니다.
           - 예: IF 노드에서 조건에 따라 'True' 또는 'False' 경로 중 하나만 실행.

        Args:
            node_id: 현재 노드 ID
            result: 현재 노드의 실행 결과

        Returns:
            다음 실행할 노드 ID 목록
        """
        selected_handle = result.get("selected_handle")

        # [PERF] 분기가 있는 경우 (O(1))
        if selected_handle is not None:
            key = (node_id, selected_handle)
            next_nodes = self.edge_handles.get(key, [])

            return next_nodes

        # [PERF] 분기가 없는 경우 (O(1))
        return self.adjacency_list.get(node_id, [])

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """
        현재 노드에 선행되는 노드가 모두 완료되었는지 확인

        [PERF] reverse_graph 캐시를 사용하여 O(1) 조회 (기존: O(E) 순회)
        """
        required_inputs = self.reverse_graph.get(node_id, [])
        return all(inp in results for inp in required_inputs)

    def _build_optimized_graph(self):
        """엣지를 분석하여 효율적인 그래프 구조 생성 (O(E) 한 번만)"""
        for edge in self.edges:
            # 정방향 그래프 (source -> targets)
            if edge.source not in self.adjacency_list:
                self.adjacency_list[edge.source] = []
            self.adjacency_list[edge.source].append(edge.target)

            # 역방향 그래프 (target -> sources) - _is_ready 최적화용
            if edge.target not in self.reverse_graph:
                self.reverse_graph[edge.target] = []
            self.reverse_graph[edge.target].append(edge.source)

            # 핸들별 엣지 매핑 (분기 처리 최적화)
            key = (edge.source, edge.sourceHandle)
            if key not in self.edge_handles:
                self.edge_handles[key] = []
            self.edge_handles[key].append(edge.target)

    def _build_node_instances(self):
        """NodeSchema를 실제 Node 인스턴스로 변환 (NodeFactory 사용)"""
        for node_id, schema in self.node_schemas.items():
            # 메모 노드는 UI 전용이므로 인스턴스 생성 스킵
            if schema.type == "note":
                continue

            try:
                self.node_instances[node_id] = NodeFactory.create(
                    schema, context=self.execution_context
                )
            except NotImplementedError as e:
                # 미구현 노드 타입에 대한 명확한 에러 메시지
                raise NotImplementedError(
                    f"Cannot create node '{node_id}': {str(e)}"
                ) from e

    def _get_context(self, node_id: str, results: Dict) -> Dict[str, Any]:
        """
        현재 노드가 실행에 필요한 모든 입력 데이터를 구성

        Returns:
            inputs: {
                # Node ID 네임스페이스 (명확성)
                "node-a-id": {"key1": "value1"},
                "node-b-id": {"key2": "value2"}
            }

        특별 케이스:
            - StartNode: user_input을 직접 전달 (네임스페이스 없이)
        """
        # StartNode 또는 WebhookTriggerNode, ScheduleTriggerNode는 user_input을 직접 받음
        node_schema = self.node_schemas.get(node_id)
        if node_schema and node_schema.type in [
            "startNode",
            "webhookTrigger",
            "scheduleTrigger",
        ]:
            return self.user_input

        # 실행된 모든 노드의 결과를 전달 (조상 노드 참조 가능)
        # 참조만 전달하므로 메모리 복사 오버헤드 최소화
        return dict(results)

    def _get_answer_node_result(self, results: Dict) -> Dict[str, Any]:
        """
        배포 모드에서 AnswerNode의 결과만 추출하여 반환합니다.

        Args:
            results: 모든 노드의 실행 결과

        Returns:
            AnswerNode의 실행 결과

        Raises:
            ValueError: AnswerNode를 찾을 수 없는 경우
        """
        # [PERF] O(N) → O(1) 개선: 타입별 인덱스 활용
        answer_nodes = self.nodes_by_type.get("answerNode", [])

        # 실행된 첫 번째 answerNode 찾기
        for node_id in answer_nodes:
            if node_id in results:
                return results[node_id]

        # 실행된 AnswerNode가 없는 경우
        # raise ValueError(
        #     "배포된 워크플로우에는 실행된 AnswerNode가 필요합니다. "
        #     "조건 분기로 인해 AnswerNode가 실행되지 않았거나, AnswerNode가 워크플로우에 없습니다."
        # )

    def _extract_node_options(self, node_schema) -> Dict[str, Any]:
        """
        노드 설정을 process_data용 스냅샷으로 추출합니다.
        실행 시점의 노드 옵션을 로그에 저장하여 디버깅/분석에 활용합니다.

        Args:
            node_schema: 노드 스키마 (NodeSchema)

        Returns:
            노드 옵션 스냅샷 딕셔너리
        """
        try:
            # node_schema.data를 그대로 복사
            data = dict(node_schema.data) if node_schema.data else {}

            return {
                "node_options": data,
                "node_title": data.get("title", ""),
            }
        except Exception as e:
            # 스냅샷 추출 실패 시에도 워크플로우 실행은 계속
            print(f"[WorkflowEngine] 노드 옵션 스냅샷 추출 실패: {e}")
            return {}
