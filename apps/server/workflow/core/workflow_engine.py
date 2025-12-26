from collections import deque
from typing import Any, Dict, List

from schemas.workflow import EdgeSchema, NodeSchema
from workflow.core.workflow_node_factory import NodeFactory


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진"""

    def __init__(self, nodes: List[NodeSchema], edges: List[EdgeSchema]):
        self.node_schemas = {node.id: node for node in nodes}  # Schema 보관
        self.node_instances = {}  # Node 인스턴스 저장
        self.edges = edges
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
                inputs = self._get_inputs(node_id, results)
                result = node_instance.execute(inputs)
                results[node_id] = result
            except Exception as e:
                results[node_id] = {"error": str(e)}
                raise

            # end 노드면 종료 (실행 후 종료)
            if node_schema.type == "end":
                break

            # 다음 노드들을 ready_queue에 추가
            for next_node_id in self.graph.get(node_id, []):
                if self._is_ready(next_node_id, results):
                    ready_queue.append(next_node_id)

        return results

    def _find_start_node(self) -> str:
        """시작 노드 찾기 (type == "start"인 노드)"""
        start_nodes = []

        # 모든 노드를 순회하면서 start 타입 찾기
        for node_id, node in self.node_schemas.items():
            if node.type == "start":
                start_nodes.append(node_id)

        if len(start_nodes) > 1:
            raise ValueError(
                f"워크플로우에 시작 노드가 {len(start_nodes)}개 있습니다. 시작 노드는 1개만 있어야 합니다."
            )

        elif len(start_nodes) == 0:
            raise ValueError("워크플로우에 시작 노드(type='start')가 없습니다.")

        return start_nodes[0]

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        required_inputs = [edge.source for edge in self.edges if edge.target == node_id]
        return all(inp in results for inp in required_inputs)

    def _build_node_instances(self):
        """NodeSchema를 실제 Node 인스턴스로 변환 (NodeFactory 사용)"""
        for node_id, schema in self.node_schemas.items():
            try:
                self.node_instances[node_id] = NodeFactory.create(schema)
            except NotImplementedError as e:
                # 미구현 노드 타입에 대한 명확한 에러 메시지
                raise NotImplementedError(
                    f"Cannot create node '{node_id}': {str(e)}"
                ) from e

    def _get_inputs(self, node_id: str, results: Dict) -> Dict[str, Any]:
        """현재 노드가 필요한 입력 데이터를 results에서 찾아서 모으는 method"""

        # TODO: 현재 노드가 필요한 입력 데이터 찾기 (입력 변수)
        # TODO: results에서 찾아서 inputs으로 전달해주기
        # TODO: 현재는 그냥 이전 노드들의 입력값을 모두 전달하는 방식입니다.

        inputs = {}
        for edge in self.edges:
            if edge.target == node_id:
                inputs[edge.source] = results.get(edge.source, {})
        return inputs
