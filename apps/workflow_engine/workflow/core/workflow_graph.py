"""
WorkflowGraph - 워크플로우 그래프 구조 분석 및 검증

노드/엣지 스키마만으로 동작하는 순수 로직입니다. (실행, 로깅, I/O 없음)
"""

from typing import Any, Dict, List, Optional, Set

from apps.shared.schemas.workflow import EdgeSchema, NodeSchema

# 워크플로우의 진입점이 되는 노드 타입 (user_input을 입력으로 받음)
TRIGGER_TYPES = ("startNode", "webhookTrigger", "scheduleTrigger")

# 실행/검증 대상에서 제외되는 노드 타입
NOTE_TYPE = "note"


class WorkflowGraph:
    """노드와 엣지로부터 탐색용 인덱스를 미리 계산해 두는 그래프"""

    def __init__(self, nodes: List[NodeSchema], edges: List[EdgeSchema]):
        self.node_schemas: Dict[str, NodeSchema] = {node.id: node for node in nodes}
        self.edges = edges
        self.start_node_id: Optional[str] = None

        # [PERF] 그래프 구조 사전 계산
        self.adjacency_list: Dict[str, List[str]] = {}
        self.reverse_graph: Dict[str, List[str]] = {}
        self.edge_handles: Dict[tuple, List[str]] = {}
        self.data_dependencies: Dict[str, Set[str]] = {}
        self.nodes_by_type: Dict[str, List[str]] = {}

        self._build_edge_index()
        self._analyze_data_dependencies()
        self._build_type_index()

    # ================================================================
    # 탐색
    # ================================================================

    def find_start_node(self) -> str:
        """시작 노드 찾기"""
        if self.start_node_id is None:
            raise ValueError(
                "시작 노드가 설정되지 않았습니다. validate()를 먼저 호출해주세요."
            )
        return self.start_node_id

    def is_trigger(self, node_id: str) -> bool:
        """시작(트리거) 노드 여부"""
        schema = self.node_schemas.get(node_id)
        return schema is not None and schema.type in TRIGGER_TYPES

    def get_next_nodes(self, node_id: str, result: Dict[str, Any]) -> List[str]:
        """현재 노드의 다음 노드 목록을 반환합니다."""
        selected_handle = result.get("selected_handle")

        if selected_handle is not None:
            return self.edge_handles.get((node_id, selected_handle), [])

        return self.adjacency_list.get(node_id, [])

    def is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        if node_id in self.data_dependencies:
            required_inputs = self.data_dependencies[node_id]
        else:
            required_inputs = self.reverse_graph.get(node_id, [])

        return all(inp in results for inp in required_inputs)

    def clear(self):
        """메모리 정리"""
        self.node_schemas.clear()
        self.adjacency_list.clear()
        self.reverse_graph.clear()
        self.edge_handles.clear()
        self.data_dependencies.clear()
        self.nodes_by_type.clear()
        self.edges = None

    # ================================================================
    # 검증
    # ================================================================

    def validate(self):
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
        start_nodes = [
            node_id
            for node_id, node in self.node_schemas.items()
            if node.type in TRIGGER_TYPES
        ]

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
        start_node_id = self.find_start_node()
        visited = {start_node_id}
        queue = [start_node_id]

        while queue:
            current_node = queue.pop(0)
            neighbors = self.adjacency_list.get(current_node, [])
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        valid_nodes = {
            node_id
            for node_id, schema in self.node_schemas.items()
            if schema.type != NOTE_TYPE
        }

        isolated_nodes = valid_nodes - visited

        if isolated_nodes:
            raise ValueError(
                f"시작 노드에서 도달할 수 없는 고립된 노드가 발견되었습니다. "
                f"노드 IDs: {list(isolated_nodes)}"
            )

    # ================================================================
    # 인덱스 구성
    # ================================================================

    def _build_edge_index(self):
        """엣지를 분석하여 효율적인 그래프 구조 생성"""
        for edge in self.edges:
            self.adjacency_list.setdefault(edge.source, []).append(edge.target)
            self.reverse_graph.setdefault(edge.target, []).append(edge.source)
            self.edge_handles.setdefault((edge.source, edge.sourceHandle), []).append(
                edge.target
            )

    def _build_type_index(self):
        """타입별 노드 인덱스"""
        for node_id, schema in self.node_schemas.items():
            self.nodes_by_type.setdefault(schema.type, []).append(node_id)

    def _analyze_data_dependencies(self):
        """각 노드의 value_selector를 분석하여 실제 데이터 의존성을 추출합니다."""
        for node_id, schema in self.node_schemas.items():
            if schema.type in TRIGGER_TYPES:
                self.data_dependencies[node_id] = set()
            else:
                self.data_dependencies[node_id] = self._extract_value_selectors(schema)

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
