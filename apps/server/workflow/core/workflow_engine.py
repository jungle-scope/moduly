from collections import deque
from typing import Any, Dict, List, Union, Optional

from sqlalchemy.orm import Session

from schemas.workflow import EdgeSchema, NodeSchema
from workflow.core.workflow_node_factory import NodeFactory
from workflow.core.workflow_logger import WorkflowLogger  # [NEW] 로깅 유틸리티


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진"""

    def __init__(
        self,
        graph: Union[Dict[str, Any], tuple[List[NodeSchema], List[EdgeSchema]]],
        user_input: Dict[str, Any] = None,
        execution_context: Dict[str, Any] = None,
        is_deployed: bool = False,
        db: Optional[Session] = None,  # [NEW] DB 세션 주입 (로깅용)
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
        self.execution_context = execution_context or {}
        
        # [FIX] DB 세션을 execution_context에 주입 (WorkflowNode 등에서 사용)
        if db is not None:
            self.execution_context["db"] = db
        
        # [PERF] 그래프 구조 사전 계산
        self.adjacency_list = {}  # source -> [targets]
        self.reverse_graph = {}   # target -> [sources]
        self.edge_handles = {}    # (source, handle) -> [targets]
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

    def execute(self) -> Dict[str, Any]:
        """
        워크플로우 전체 실행 (Wrapper)
        execute_stream을 호출하여 실행하고, 최종 결과만 반환합니다.
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
        워크플로우를 실행하고 진행 상황을 제너레이터로 반환합니다. (SSE 스트리밍용)
        각 실행 단계마다 이벤트를 yield하여 클라이언트가 실시간으로 상태를 알 수 있게 합니다.

        Yields Events:
        - node_start: 노드 실행 시작
        - node_finish: 노드 실행 완료 (결과 포함)
        - workflow_finish: 전체 워크플로우 완료
        - error: 실행 중 오류 발생
        """
        yield from self._execute_core(stream_mode=True)

    def execute_deployed(self):
        """
        워크플로우 실행 로직
        streaming이 필요 없는 배포된 workflow를 실행할 때 사용합니다.
        """
        # _execute_core는 제너레이터이므로, 값을 반환받으려면 StopIteration의 value를 가져와야 함
        gen = self._execute_core(stream_mode=False)
        try:
            while True:
                next(gen)
        except StopIteration as e:
            return e.value

    def _execute_core(self, stream_mode: bool = False):
        """
        핵심 실행 로직 - 스트리밍/배포 모드 공용
        Args:
            stream_mode: True면 이벤트를 yield, False면 결과만 반환
        """
        # ============================================================
        # [NEW] 실행 로그 시작
        # ============================================================
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
        ready_queue = deque([start_node])
        results = {}

        try:
            # 1. 워크플로우 시작 이벤트 (스트림 모드만)
            if stream_mode:
                yield {"type": "workflow_start", "data": {}}

            try:
                node_id = start_node  # 초기화 (finally 블록에서 참조 위함)

                while ready_queue:
                    node_id = ready_queue.popleft()

                    # node_id가 존재하는지 확인
                    if node_id not in self.node_instances:
                        error_msg = f"노드 ID '{node_id}'를 찾을 수 없습니다."
                        if stream_mode:
                            self.logger.update_run_log_error(error_msg)
                            yield {
                                "type": "error",
                                "data": {"node_id": node_id, "message": error_msg},
                            }
                            return
                        else:
                            raise ValueError(error_msg)

                    # 이미 실행된 노드는 스킵
                    if node_id in results:
                        continue

                    node_instance = self.node_instances[node_id]
                    node_schema = self.node_schemas[node_id]

                    # 2. 노드 시작 이벤트 (스트림 모드만)
                    if stream_mode:
                        yield {
                            "type": "node_start",
                            "data": {"node_id": node_id, "node_type": node_schema.type},
                        }

                    # 노드 실행
                    try:
                        inputs = self._get_context(node_id, results)

                        # [NEW] 노드 로깅
                        self.logger.create_node_log(node_id, node_schema.type, inputs)

                        result = node_instance.execute(inputs)
                        results[node_id] = result

                        # [NEW] 노드 완료 로깅
                        self.logger.update_node_log_finish(node_id, result)

                        # 3. 노드 종료 이벤트 (스트림 모드만)
                        if stream_mode:
                            yield {
                                "type": "node_finish",
                                "data": {
                                    "node_id": node_id,
                                    "node_type": node_schema.type,
                                    "output": result,
                                },
                            }

                    except Exception as e:
                        error_msg = str(e)
                        # [NEW] 노드 에러 로깅
                        self.logger.update_node_log_error(node_id, error_msg)

                        if stream_mode:
                            self.logger.update_run_log_error(error_msg)
                            yield {
                                "type": "error",
                                "data": {"node_id": node_id, "message": error_msg},
                            }
                            return
                        else:
                            raise Exception(f"노드 '{node_id}' 실행 중 오류 발생: {error_msg}")

                    # 다음 노드들을 ready_queue에 추가
                    for next_node_id in self._get_next_nodes(node_id, result):
                        if self._is_ready(next_node_id, results):
                            ready_queue.append(next_node_id)

                # 4. 워크플로우 종료
                if stream_mode:
                    final_context = self._get_context(node_id, results)
                    # [NEW] 실행 완료 로깅
                    self.logger.update_run_log_finish(final_context)
                    yield {"type": "workflow_finish", "data": final_context}
                else:
                    # 배포 모드에서는 AnswerNode 결과 반환
                    final_result = self._get_answer_node_result(results)
                    # [NEW] 실행 완료 로깅
                    self.logger.update_run_log_finish(final_result)
                    return final_result

            except Exception as e:
                # 외부 루프 에러 처리 (execute_deployed에서 발생한 예외 or 기타 예외)
                if not stream_mode:
                    # 배포 모드: 이미 throw된 예외가 많겠지만, 여기서 run log error 한번 더 챙김
                    self.logger.update_run_log_error(str(e))
                    raise e
                else:
                    # 스트림 모드: 혹시 놓친 에러가 있다면
                    error_msg = str(e)
                    self.logger.update_run_log_error(error_msg)
                    yield {"type": "error", "data": {"message": error_msg}}
        finally:
            # [PERF] 비동기 로깅 종료 대기 (Flush)
            self.logger.shutdown()

    # ================================================================
    # 기존 헬퍼 메서드들 (변경 없음)
    # ================================================================

    def _find_start_node(self) -> str:
        """시작 노드 찾기 (type == "startNode"인 노드)"""
        start_nodes = []

        # 모든 노드를 순회하면서 startNode 타입 찾기
        for node_id, node in self.node_schemas.items():
            if node.type == "startNode":
                start_nodes.append(node_id)

        if len(start_nodes) > 1:
            raise ValueError(
                f"워크플로우에 시작 노드가 {len(start_nodes)}개 있습니다. 시작 노드는 1개만 있어야 합니다."
            )

        elif len(start_nodes) == 0:
            raise ValueError("워크플로우에 시작 노드(type='startNode')가 없습니다.")

        return start_nodes[0]

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
            return self.edge_handles.get(key, [])

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
                self.node_instances[node_id] = NodeFactory.create(schema, context=self.execution_context)
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
        # StartNode는 user_input을 직접 받음
        node_schema = self.node_schemas.get(node_id)
        if node_schema and node_schema.type == "startNode":
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
        raise ValueError(
            "배포된 워크플로우에는 실행된 AnswerNode가 필요합니다. "
            "조건 분기로 인해 AnswerNode가 실행되지 않았거나, AnswerNode가 워크플로우에 없습니다."
        )
