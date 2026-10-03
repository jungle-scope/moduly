"""
WorkflowEngine - Gevent-based Workflow Execution Engine

[GEVENT] Migrated from asyncio to gevent for Celery gevent pool compatibility.
"""

import time
import types
import uuid
from typing import Any, Dict, List, Optional, Union

from sqlalchemy.orm import Session

from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.run_reporter import RunReporter
from apps.workflow_engine.workflow.core.workflow_graph import NOTE_TYPE, WorkflowGraph
from apps.workflow_engine.workflow.core.workflow_logger import WorkflowLogger
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory
from apps.workflow_engine.workflow.core.workflow_run import WorkflowRun


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
        else:
            nodes, edges = graph

        self.is_deployed = is_deployed
        self.graph = WorkflowGraph(nodes, edges)
        self.node_instances = {}
        self.user_input = user_input if user_input is not None else {}
        self.execution_context = dict(execution_context) if execution_context else {}
        self.workflow_timeout = workflow_timeout

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

        실행마다 WorkflowRun을 새로 만들어 위임합니다. (엔진 재실행 가능)
        """
        started_at = time.time()

        self._start_run_log()

        # [FIX] execution_context를 읽기 전용으로 동결 (greenlet 간 동시 변경 방지)
        self.execution_context = types.MappingProxyType(dict(self.execution_context))

        reporter = RunReporter(
            logger=self.logger,
            run_id=self.execution_context.get("workflow_run_id"),
            is_subworkflow=self.is_subworkflow,
            stream_mode=stream_mode,
        )
        run = WorkflowRun(
            graph=self.graph,
            node_instances=self.node_instances,
            user_input=self.user_input,
            reporter=reporter,
            stream_mode=stream_mode,
            timeout=self.workflow_timeout,
            started_at=started_at,
        )

        yield from run.execute()

    def _start_run_log(self):
        """
        실행 로그를 시작하고 execution_context에 workflow_run_id를 확정합니다.

        - 서브 워크플로우 / parent_run_id만 있는 경우: 부모 run에 연결 (run log 생성 안 함)
        - 외부에서 workflow_run_id를 받은 경우: 해당 ID로 run log 생성
        - 그 외: 새 run_id로 run log 생성
        """
        external_run_id = self.execution_context.get("workflow_run_id")

        if self.is_subworkflow:
            if self.parent_run_id:
                self._attach_to_parent_run()
        elif external_run_id:
            self.logger.workflow_run_id = uuid.UUID(external_run_id)
            self._create_run_log(external_run_id=external_run_id)
        elif self.parent_run_id:
            self._attach_to_parent_run()
        else:
            workflow_run_id = self._create_run_log()

            if workflow_run_id:
                self.execution_context["workflow_run_id"] = str(workflow_run_id)

    def _attach_to_parent_run(self):
        self.logger.workflow_run_id = uuid.UUID(self.parent_run_id)
        self.execution_context["workflow_run_id"] = self.parent_run_id

    def _create_run_log(self, **kwargs):
        # [GEVENT] 직접 동기 호출 (gevent가 I/O를 처리)
        return self.logger.create_run_log(
            workflow_id=self.execution_context.get("workflow_id"),
            user_id=self.execution_context.get("user_id"),
            user_input=self.user_input,
            is_deployed=self.is_deployed,
            execution_context=self.execution_context,
            **kwargs,
        )

    # ================================================================
    # 헬퍼 메서드들
    # ================================================================

    def validate_graph(self):
        """워크플로우 그래프의 구조적 유효성을 검사합니다."""
        self.graph.validate()

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
