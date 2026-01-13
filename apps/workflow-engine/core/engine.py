"""
WorkflowEngine 래퍼

기존 apps/server/workflow/core/workflow_engine.py를 래핑하여
마이크로서비스 환경에서 사용할 수 있도록 합니다.

TODO: 점진적으로 기존 코드를 이 모듈로 이동
"""
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from apps.shared.utils.log_helper import log_node_run_start, log_node_run_finish


class WorkflowEngine:
    """
    워크플로우 실행 엔진 (마이크로서비스용 래퍼)
    
    기존 WorkflowEngine을 래핑하여 이벤트 발행 기능을 추가합니다.
    """
    
    def __init__(
        self,
        graph: Dict[str, Any],
        user_input: Dict[str, Any],
        db: Session,
        workflow_id: str,
        run_id: str,
        event_publisher: Optional[Callable[[str, Dict], None]] = None,
        **kwargs,
    ):
        """
        Args:
            graph: 워크플로우 그래프 {nodes: [], edges: []}
            user_input: 사용자 입력값
            db: DB 세션
            workflow_id: 워크플로우 ID
            run_id: 실행 ID
            event_publisher: 이벤트 발행 콜백 (Redis Pub/Sub 전송용)
            **kwargs: 추가 컨텍스트 (user_id, deployment_id 등)
        """
        self.graph = graph
        self.user_input = user_input
        self.db = db
        self.workflow_id = workflow_id
        self.run_id = run_id
        self.event_publisher = event_publisher
        self.context = kwargs
        
        # 노드 및 엣지 파싱
        self.nodes = {node["id"]: node for node in graph.get("nodes", [])}
        self.edges = graph.get("edges", [])
        
        # 실행 결과 저장
        self.outputs: Dict[str, Any] = {}
        self.total_tokens = 0
        self.total_cost = 0.0
    
    def _publish_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """이벤트 발행 (설정된 경우에만)"""
        if self.event_publisher:
            self.event_publisher(event_type, data)
    
    def execute_with_events(self) -> Dict[str, Any]:
        """
        이벤트를 발행하면서 워크플로우 실행
        
        각 노드 실행 시 node_start, node_finish 이벤트 발행
        
        Returns:
            {"outputs": dict, "status": str, "total_tokens": int, "total_cost": float}
        """
        # 실행 순서 계산
        execution_order = self._get_execution_order()
        
        # 각 노드 실행
        for node_id in execution_order:
            node = self.nodes[node_id]
            node_type = node.get("type", "unknown")
            
            # 노드 시작 이벤트
            self._publish_event("node_start", {
                "run_id": self.run_id,
                "node_id": node_id,
                "node_type": node_type,
            })
            
            # 노드 시작 로그
            log_node_run_start(
                run_id=self.run_id,
                node_id=node_id,
                node_type=node_type,
                inputs=node.get("data", {}),
            )
            
            try:
                # 노드 실행
                result = self._execute_node(node_id, node)
                
                # 결과 저장
                self.outputs[node_id] = result
                
                # 노드 완료 이벤트
                self._publish_event("node_finish", {
                    "run_id": self.run_id,
                    "node_id": node_id,
                    "node_type": node_type,
                    "outputs": result,
                })
                
                # 노드 완료 로그
                log_node_run_finish(
                    run_id=self.run_id,
                    node_id=node_id,
                    status="success",
                    outputs=result,
                )
                
            except Exception as e:
                # 노드 에러 이벤트
                self._publish_event("node_error", {
                    "run_id": self.run_id,
                    "node_id": node_id,
                    "error": str(e),
                })
                
                # 노드 에러 로그
                log_node_run_finish(
                    run_id=self.run_id,
                    node_id=node_id,
                    status="failed",
                    error_message=str(e),
                )
                
                raise
        
        # 최종 결과 반환
        return {
            "outputs": self._get_final_outputs(),
            "status": "success",
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
        }
    
    def _get_execution_order(self) -> List[str]:
        """
        실행 순서 계산 (토폴로지 정렬)
        
        TODO: 기존 WorkflowEngine의 그래프 분석 로직 사용
        """
        # 간단한 구현: startNode부터 시작
        start_nodes = [
            node_id for node_id, node in self.nodes.items()
            if node.get("type") == "startNode"
        ]
        
        if not start_nodes:
            return list(self.nodes.keys())
        
        # BFS로 순서 결정
        order = []
        visited = set()
        queue = start_nodes.copy()
        
        while queue:
            node_id = queue.pop(0)
            if node_id in visited:
                continue
            
            visited.add(node_id)
            order.append(node_id)
            
            # 다음 노드 찾기
            for edge in self.edges:
                if edge.get("source") == node_id:
                    target = edge.get("target")
                    if target and target not in visited:
                        queue.append(target)
        
        return order
    
    def _execute_node(self, node_id: str, node: Dict[str, Any]) -> Dict[str, Any]:
        """
        단일 노드 실행
        
        TODO: 기존 WorkflowEngine의 노드 실행 로직 연결
        """
        node_type = node.get("type", "unknown")
        node_data = node.get("data", {})
        
        # 노드 타입별 실행 (임시 구현)
        # TODO: 실제 노드 팩토리 연결
        if node_type == "startNode":
            return self.user_input
        elif node_type == "answerNode":
            return {"answer": "워크플로우 완료"}
        else:
            # 기본 패스스루
            return node_data
    
    def _get_final_outputs(self) -> Dict[str, Any]:
        """
        최종 출력값 추출
        
        answerNode의 출력값 반환
        """
        for node_id, node in self.nodes.items():
            if node.get("type") == "answerNode":
                return self.outputs.get(node_id, {})
        
        return self.outputs
