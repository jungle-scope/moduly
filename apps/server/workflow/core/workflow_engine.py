from collections import deque
from typing import Any, Dict, List, Union

from schemas.workflow import EdgeSchema, NodeSchema
from workflow.core.workflow_node_factory import NodeFactory


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진"""

    def __init__(
        self,
        graph: Union[Dict[str, Any], tuple[List[NodeSchema], List[EdgeSchema]]],
        user_input: Dict[str, Any] = None,
    ):
        """
        WorkflowEngine 초기화

        Args:
            graph: 워크플로우 그래프 데이터
                - Dict 형태: {"nodes": [...], "edges": [...], "viewport": ...}
            user_input: 사용자가 입력한 변수 값들
        """
        # graph가 딕셔너리인 경우 nodes와 edges 추출
        if isinstance(graph, dict):
            nodes = [NodeSchema(**node) for node in graph.get("nodes", [])]
            edges = [EdgeSchema(**edge) for edge in graph.get("edges", [])]

        self.node_schemas = {node.id: node for node in nodes}  # Schema 보관
        self.node_instances = {}  # Node 인스턴스 저장
        self.edges = edges
        self.user_input = user_input if user_input is not None else {}
        self.graph = self._build_graph()
        self._build_node_instances()  # Schema → Node 변환

    def _build_graph(self) -> Dict[str, List[str]]:
        """엣지로부터 그래프 구조 생성 (인접 리스트)"""
        graph = {}
        for edge in self.edges:
            if edge.source not in graph:
                graph[edge.source] = []
            graph[edge.source].append(edge.target)
        return graph

    def execute(self) -> Dict[str, Any]:
        """워크플로우 전체 실행 (Queue 기반)"""
        start_node = self._find_start_node()
        ready_queue = deque([start_node])
        results = {}

        while ready_queue:
            node_id = ready_queue.popleft()

            # node_id가 존재하는지 확인
            if node_id not in self.node_instances:
                error_msg = f"노드 ID '{node_id}'를 찾을 수 없습니다."
                results[node_id] = {"error": error_msg}
                raise ValueError(error_msg)

            # 이미 실행된 노드는 스킵
            if node_id in results:
                continue

            node_instance = self.node_instances[node_id]
            node_schema = self.node_schemas[node_id]

            # 노드 실행: 입력 데이터 준비 후 Node.execute() 호출
            try:
                inputs = self._get_context(node_id, results)
                result = node_instance.execute(inputs)
                results[node_id] = result
            except Exception as e:
                results[node_id] = {"error": str(e)}
                raise

            # end 노드면 종료 (실행 후 종료)
            if node_schema.type == "end":
                break

            # 다음 노드들을 ready_queue에 추가 (분기 노드 처리 포함)
            for next_node_id in self._get_next_nodes(node_id, result):
                if self._is_ready(next_node_id, results):
                    ready_queue.append(next_node_id)

        return self._get_context(node_id, results)

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
        분기 노드의 경우 selected_handle과 일치하는 엣지만 반환합니다.

        Args:
            node_id: 현재 노드 ID
            result: 현재 노드의 실행 결과

        Returns:
            다음 실행할 노드 ID 목록
        """
        selected_handle = result.get("selected_handle")
        next_nodes = []

        for edge in self.edges:
            if edge.source != node_id:
                continue

            # selected_handle이 있으면 sourceHandle과 비교
            if selected_handle is not None:
                if edge.sourceHandle != selected_handle:
                    continue

            next_nodes.append(edge.target)

        return next_nodes

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        required_inputs = [edge.source for edge in self.edges if edge.target == node_id]
        return all(inp in results for inp in required_inputs)

    def _build_node_instances(self):
        """NodeSchema를 실제 Node 인스턴스로 변환 (NodeFactory 사용)"""
        for node_id, schema in self.node_schemas.items():
            # 메모 노드는 UI 전용이므로 인스턴스 생성 스킵
            if schema.type == "note":
                continue

            try:
                self.node_instances[node_id] = NodeFactory.create(schema)
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

        # 다른 노드들은 이전 노드 결과만 받음
        inputs = {}
        for prev_id, output in results.items():
            # node_id로 감싸서 추가 (명확성/충돌 해결)
            inputs[prev_id] = output

        return inputs
