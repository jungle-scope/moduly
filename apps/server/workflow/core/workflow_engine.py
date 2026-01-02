from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Union, Optional
import uuid

from sqlalchemy.orm import Session

from schemas.workflow import EdgeSchema, NodeSchema
from workflow.core.workflow_node_factory import NodeFactory

# [NEW] 로깅 모델 Import
from db.models.workflow_run import WorkflowRun, WorkflowNodeRun


class WorkflowEngine:
    """노드와 엣지를 받아서 전체 워크플로우 실행을 담당하는 엔진"""

    def __init__(
        self,
        graph: Union[Dict[str, Any], tuple[List[NodeSchema], List[EdgeSchema]]],
        user_input: Dict[str, Any] = None,
        execution_context: Dict[str, Any] = None,
        is_deployed: bool = False,
        db: Optional[Session] = None,  # [NEW] DB 세션 주입
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
        else: # [NEW] Handle tuple case for graph
            nodes, edges = graph

        self.is_deployed = is_deployed  # 배포 모드 플래그
        self.node_schemas = {node.id: node for node in nodes}  # Schema 보관
        self.node_instances = {}  # Node 인스턴스 저장
        self.edges = edges
        self.user_input = user_input if user_input is not None else {}
        self.execution_context = execution_context or {}
        self.graph = self._build_graph() # This will be rebuilt based on the new graph structure
        self._build_node_instances()  # Schema → Node 변환
        self.db = db  # [NEW]
        self.workflow_run_id = None  # [NEW] 실행 ID

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
        워크플로우를 실행하고, 실행 과정을 제너레이터로 반환 (SSE용)
        """
        # [NEW] 워크플로우 실행 로그 생성
        self._create_run_log()

        # 1. 그래프 파싱 및 노드 map 생성
        if isinstance(self.graph, tuple):
            nodes, edges = self.graph
        else:
            # This part is inconsistent with the __init__ logic.
            # The original __init__ already parses graph into nodes and edges.
            # The new __init__ also handles tuple.
            # Let's assume self.node_schemas and self.edges are already correctly set up.
            nodes = list(self.node_schemas.values())
            edges = self.edges

        # 노드 ID로 노드 객체를 빠르게 찾기 위한 맵
        node_map = self.node_schemas # Already available as self.node_schemas

        # 2. 인접 리스트 빌드 (진출 차수) & 진입 차수 계산
        # This logic is different from the original _build_graph and _is_ready.
        # The original uses a dependency graph based on edges.
        # The new logic uses topological sort based on in-degrees.
        # I will replace the existing logic with the new one provided in the diff.
        adj_list = {node.id: [] for node in nodes}
        in_degree = {node.id: 0 for node in nodes}

        for edge in edges:
            if edge.source in adj_list and edge.target in in_degree:
                adj_list[edge.source].append(edge.target)
                in_degree[edge.target] += 1

        # 3. 위상 정렬을 위한 큐 초기화 (진입 차수가 0인 노드)
        queue = deque([node.id for node in nodes if in_degree[node.id] == 0])

        # 실행 컨텍스트 초기화 (전역 상태)
        # TODO: 상태 관리 로직 분리 필요
        context = self.user_input.copy()
        
        # [NEW] 실행 ID를 컨텍스트에 주입 (LLM 노드 등에서 사용)
        if self.workflow_run_id:
            self.execution_context["workflow_run_id"] = str(self.workflow_run_id)

        yield {"type": "workflow_start", "data": {}}

        while queue:
            node_id = queue.popleft()
            node_schema = node_map[node_id]

            # 노드 인스턴스 생성 (팩토리 패턴)
            # This part is also different from _build_node_instances.
            # The original builds all instances at init. The new one builds them on the fly.
            # I will use the new logic for execute_stream.
            node_instance = NodeFactory.create( # Changed from create_node to create to match existing NodeFactory usage
                node_schema, context=self.execution_context # Changed arguments to match existing NodeFactory.create
            )

            # [NEW] 노드 실행 시작 로그
            self._create_node_log(node_id, node_schema.type, context)

            yield {
                "type": "node_start",
                "data": {"node_id": node_id, "node_type": node_schema.type},
            }

            try:
                # 노드 실행
                # [NEW] 상태 업데이트 (running)
                self._update_node_log_running(node_id)
                
                result = node_instance.execute(context)

                # 컨텍스트 업데이트 (출력값을 다음 노드의 입력으로 사용)
                if isinstance(result, dict):
                    context.update(result)

                # [NEW] 노드 실행 완료 로그
                self._update_node_log_finish(node_id, result)

                yield {
                    "type": "node_finish",
                    "data": {
                        "node_id": node_id,
                        "node_type": node_schema.type,
                        "output": result,
                    },
                }

                # 다음 노드 탐색
                if node_id in adj_list:
                    for neighbor_id in adj_list[node_id]:
                        in_degree[neighbor_id] -= 1
                        if in_degree[neighbor_id] == 0:
                            queue.append(neighbor_id)

            except Exception as e:
                # [NEW] 노드 실행 에러 로그
                self._update_node_log_error(node_id, str(e))
                self._update_run_log_error(str(e)) # 전체 실행 실패 처리

                yield {
                    "type": "error",
                    "data": {"node_id": node_id, "message": str(e)},
                }
                # 에러 발생 시 워크플로우 중단
                return

        final_context = context
        # [NEW] 워크플로우 실행 완료 로그
        self._update_run_log_finish(final_context)

        yield {"type": "workflow_finish", "data": final_context}

    def execute_deployed(self):
        """
        워크플로우 실행 로직
        streaming이 필요 없는 배포된 workflow를 실행할 때 사용합니다.
        """
        # [NEW] 실행 로그 시작
        self._create_run_log()

        start_node = self._find_start_node()
        ready_queue = deque([start_node])
        results = {}

        try:
            while ready_queue:
                node_id = ready_queue.popleft()

                # node_id가 존재하는지 확인
                if node_id not in self.node_instances:
                    raise ValueError(f"노드 ID '{node_id}'를 찾을 수 없습니다.")

                # 이미 실행된 노드는 스킵
                if node_id in results:
                    continue

                node_instance = self.node_instances[node_id]
                node_schema = self.node_schemas[node_id]

                # 노드 실행: 입력 데이터 준비 후 Node.execute() 호출
                try:
                    inputs = self._get_context(node_id, results)
                    
                    # [NEW] 노드 실행 로그 생성
                    self._create_node_log(node_id, node_schema.type, inputs)
                    self._update_node_log_running(node_id)

                    result = node_instance.execute(inputs)
                    results[node_id] = result
                    
                    # [NEW] 노드 실행 성공 로그
                    self._update_node_log_finish(node_id, result)

                except Exception as e:
                    # [NEW] 노드 실행 에러 로그
                    self._update_node_log_error(node_id, str(e))
                     # 에러 발생 시 명확한 예외를 raise
                    raise Exception(f"노드 '{node_id}' 실행 중 오류 발생: {str(e)}")

                # 다음 노드들을 ready_queue에 추가 (분기 노드 처리 포함)
                for next_node_id in self._get_next_nodes(node_id, result):
                    if self._is_ready(next_node_id, results):
                        ready_queue.append(next_node_id)

            # 배포 모드에서는 항상 AnswerNode의 결과만 반환
            final_result = self._get_answer_node_result(results)
            
            # [NEW] 실행 완료 로그
            self._update_run_log_finish(final_result)
            
            return final_result

        except Exception as e:
            # [NEW] 실행 실패 로그
            self._update_run_log_error(str(e))
            raise e

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
           - 예: 일반 노드에서 여러 갈래로 뻗어나가는 경우 모두 실행.

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
        next_nodes = []

        for edge in self.edges:
            if edge.source != node_id:
                continue

            # selected_handle이 있으면 sourceHandle과 비교 (분기 처리)
            # selected_handle이 None이면 조건문이 실행되지 않아 모든 엣지가 추가됨 (Parallel 실행 등)
            if selected_handle is not None:
                if edge.sourceHandle != selected_handle:
                    continue

            next_nodes.append(edge.target)
        return next_nodes

    # === Logging Helpers ===

    def _create_run_log(self):
        """워크플로우 실행 로그 생성"""
        if not self.db:
            return

        try:
            workflow_id = self.execution_context.get("workflow_id")
            user_id = self.execution_context.get("user_id")
            
            # workflow_id가 없으면 로깅 스킵 (Draft 실행 등에서 없을 수 있음 - 정책 결정 필요)
            # 여기서는 편의상 workflow_id가 있으면 무조건 로깅 시도
            if not workflow_id or not user_id:
                return

            run_log = WorkflowRun(
                workflow_id=uuid.UUID(str(workflow_id)),
                user_id=uuid.UUID(str(user_id)),
                status="running",
                trigger_mode="deployed" if self.is_deployed else "manual",
                inputs=self.user_input,
                started_at=datetime.now(timezone.utc),
                # [NEW] 배포 버전 정보 저장
                deployment_id=uuid.UUID(str(self.execution_context.get("deployment_id"))) if self.execution_context.get("deployment_id") else None,
                workflow_version=self.execution_context.get("workflow_version")
            )
            self.db.add(run_log)
            self.db.commit()
            self.db.refresh(run_log)
            self.workflow_run_id = run_log.id
            # self.node_run_ids = {} # 노드별 실행 ID 관리 (필요시)
            
        except Exception as e:
            print(f"[Logging Error] Create Run Log Failed: {e}")
            self.db.rollback()

    def _update_run_log_finish(self, outputs: Dict[str, Any]):
        """워크플로우 실행 완료 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return
        
        try:
            run_log = self.db.query(WorkflowRun).filter(WorkflowRun.id == self.workflow_run_id).first()
            if run_log:
                run_log.status = "success"
                run_log.outputs = outputs
                run_log.finished_at = datetime.now(timezone.utc)
                # duration 계산
                if run_log.started_at:
                    run_log.duration = (run_log.finished_at - run_log.started_at).total_seconds()
                
                # [NEW] Cost & Token Aggregation
                # LLMUsageLog에서 해당 실행의 총합 계산
                from db.models.llm import LLMUsageLog
                from sqlalchemy import func
                
                stats = (
                    self.db.query(
                        func.sum(LLMUsageLog.prompt_tokens + LLMUsageLog.completion_tokens).label("total_tokens"),
                        func.sum(LLMUsageLog.total_cost).label("total_cost")
                    )
                    .filter(LLMUsageLog.workflow_run_id == self.workflow_run_id)
                    .first()
                )
                
                if stats:
                    run_log.total_tokens = stats.total_tokens or 0
                    run_log.total_cost = stats.total_cost or 0.0

                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Run Log Failed: {e}")

    def _update_run_log_error(self, error_message: str):
        """워크플로우 실행 에러 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return
        
        try:
            run_log = self.db.query(WorkflowRun).filter(WorkflowRun.id == self.workflow_run_id).first()
            if run_log:
                run_log.status = "failed"
                run_log.error_message = error_message
                run_log.finished_at = datetime.now(timezone.utc)
                 # duration 계산
                if run_log.started_at:
                    run_log.duration = (run_log.finished_at - run_log.started_at).total_seconds()

                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Run Log Error Failed: {e}")

    def _create_node_log(self, node_id: str, node_type: str, inputs: Dict[str, Any]):
        """노드 실행 로그 생성"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            # 해당 노드에 유효한 입력값만 필터링해서 저장하면 좋겠지만, 
            # 현재는 전체 컨텍스트를 스냅샷으로 저장 (용량 주의)
            # 실제로는 Node data나 execution context에서 필요한것만 발라내는게 좋음
            
            node_run = WorkflowNodeRun(
                workflow_run_id=self.workflow_run_id,
                node_id=node_id,
                node_type=node_type,
                status="running",
                inputs=inputs, # 전체 컨텍스트 스냅샷
                started_at=datetime.now(timezone.utc)
            )
            self.db.add(node_run)
            self.db.commit()
            
            # 나중에 업데이트를 위해 어딘가에 ID 저장? 
            # 여기서는 node_id + run_id 조합으로 찾거나, DB에서 가장 최근거 가져오는 방식 사용
            
        except Exception as e:
            print(f"[Logging Error] Create Node Log Failed: {e}")
            self.db.rollback()

    def _update_node_log_running(self, node_id: str):
         # 이미 create시 running이지만, 명시적 업데이트가 필요하다면 사용
         pass

    def _update_node_log_finish(self, node_id: str, outputs: Any):
        """노드 실행 완료 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            # 가장 최근의 해당 노드 실행 로그 조회 (루프가 없다는 가정 하에)
            # 루프가 있다면 started_at desc 등으로 찾아야 함
            node_run = (
                self.db.query(WorkflowNodeRun)
                .filter(WorkflowNodeRun.workflow_run_id == self.workflow_run_id)
                .filter(WorkflowNodeRun.node_id == node_id)
                .order_by(WorkflowNodeRun.started_at.desc())
                .first()
            )
            
            if node_run:
                node_run.status = "success"
                # outputs가 dict가 아닐 수 있음 (문자열 등) -> 래핑 필요
                if isinstance(outputs, dict):
                    node_run.outputs = outputs
                else:
                    node_run.outputs = {"result": outputs}
                
                node_run.finished_at = datetime.now(timezone.utc)
                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Node Log Failed: {e}")

    def _update_node_log_error(self, node_id: str, error_message: str):
        """노드 실행 에러 로그 업데이트"""
        if not self.db or not self.workflow_run_id:
            return

        try:
            node_run = (
                self.db.query(WorkflowNodeRun)
                .filter(WorkflowNodeRun.workflow_run_id == self.workflow_run_id)
                .filter(WorkflowNodeRun.node_id == node_id)
                .order_by(WorkflowNodeRun.started_at.desc())
                .first()
            )
            
            if node_run:
                node_run.status = "failed"
                node_run.error_message = error_message
                node_run.finished_at = datetime.now(timezone.utc)
                self.db.commit()
        except Exception as e:
            print(f"[Logging Error] Update Node Log Error Failed: {e}")

    def _is_ready(self, node_id: str, results: Dict) -> bool:
        """현재 노드에 선행되는 노드가 모두 완료되었는지 확인"""
        required_inputs = [edge.source for edge in self.edges if edge.target == node_id]
        return all(inp in results for inp in required_inputs)

    def _build_graph(self) -> Dict[str, List[str]]:
        """엣지로부터 그래프 구조 생성 (인접 리스트)"""
        graph = {}
        for edge in self.edges:
            if edge.source not in graph:
                graph[edge.source] = []
            graph[edge.source].append(edge.target)
        return graph

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

        # 다른 노드들은 이전 노드 결과만 받음
        inputs = {}
        for prev_id, output in results.items():
            # node_id로 감싸서 추가 (명확성/충돌 해결)
            inputs[prev_id] = output

        return inputs

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
        # 실행된 answerNode들만 수집
        executed_answer_nodes = []
        for node_id, node_schema in self.node_schemas.items():
            if node_schema.type == "answerNode" and node_id in results:
                executed_answer_nodes.append((node_id, results[node_id]))

        # 실행된 AnswerNode가 없는 경우
        if not executed_answer_nodes:
            raise ValueError(
                "배포된 워크플로우에는 실행된 AnswerNode가 필요합니다. "
                "조건 분기로 인해 AnswerNode가 실행되지 않았거나, AnswerNode가 워크플로우에 없습니다."
            )

        # 첫 번째로 실행된 AnswerNode의 결과 반환
        return executed_answer_nodes[0][1]
