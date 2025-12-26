from collections import deque
from typing import Any, Dict, List

from schemas.workflow import EdgeSchema, NodeSchema


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진"""

    def __init__(self, nodes: List[NodeSchema], edges: List[EdgeSchema]):
        self.nodes = {node.id: node for node in nodes}
        self.edges = edges
        self.graph = self._build_graph()

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
            if node_id not in self.nodes:
                error_msg = f"노드 ID '{node_id}'를 찾을 수 없습니다."
                results[node_id] = {"error": error_msg}
                raise ValueError(error_msg)

            # 이미 실행된 노드는 스킵
            if node_id in results:
                continue

            node = self.nodes[node_id]

            # end 노드면 종료 (현재는 첫 번째 end에서 종료)
            if node.type == "end":
                results[node_id] = {"status": "completed"}
                break

            # 노드 실행
            try:
                results[node_id] = self._execute_node(node)
            except Exception as e:
                results[node_id] = {"error": str(e)}
                raise

            # 다음 노드들을 ready_queue에 추가
            for next_node_id in self.graph[node_id]:
                if self._is_ready(next_node_id, results):
                    ready_queue.append(next_node_id)

        return results

    def _find_start_node(self) -> str:
        """시작 노드 찾기 (type == "start"인 노드)"""
        start_nodes = []

        # 모든 노드를 순회하면서 start 타입 찾기
        for node_id, node in self.nodes.items():
            if node.type == "start":
                start_nodes.append(node_id)

        # 시작 노드가 2개 이상이면 예외 처리
        if len(start_nodes) > 1:
            raise ValueError(
                f"워크플로우에 시작 노드가 {len(start_nodes)}개 있습니다. 시작 노드는 1개만 있어야 합니다."
            )

        # 시작 노드가 없으면 예외 처리
        if len(start_nodes) == 0:
            raise ValueError("워크플로우에 시작 노드(type='start')가 없습니다.")

        return start_nodes[0]

    def _execute_node(self, node: NodeSchema) -> Any:
        """개별 노드 실행 (타입별 로직)"""
        if node.type == "llm":
            return self._execute_llm_node(node)
        elif node.type == "code":
            return self._execute_code_node(node)

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        required_inputs = [edge.source for edge in self.edges if edge.target == node_id]
        return all(inp in results for inp in required_inputs)
