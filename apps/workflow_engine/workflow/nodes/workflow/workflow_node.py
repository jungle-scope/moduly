import asyncio
from typing import Any, Dict, List

from apps.shared.db.models.app import App
from apps.workflow_engine.workflow.nodes.base.node import Node

from .entities import WorkflowNodeData

# 참고: 순환 참조를 피하기 위해 WorkflowEngine은 메서드 내부에서 임포트합니다.
# 하지만 WorkflowEngine은 NodeFactory에 의존하고, NodeFactory는 Node에 의존합니다...
# 순환 의존성이 발생할 가능성이 높습니다.
# 따라서 _run 메서드 내부에서 임포트를 처리합니다.


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class WorkflowNode(Node[WorkflowNodeData]):
    """
    다른 워크플로우(모듈)를 실행하는 노드.
    Function call과 유사하게 동작함.
    """

    node_type = "workflowNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

        workflow_id = self.data.workflowId
        db = self.execution_context.get("db")
        if not db:
            raise ValueError(
                f"[WorkflowNode] DB session required in execution_context for node {self.id}"
            )

        # 1. 대상 워크플로우(App)의 Active Deployment 조회
        # workflow_id는 사실상 App의 ID를 가리킴 (App 선택 UI에서 App ID를 저장하도록 가정)
        # 만약 workflow_id가 실제 Workflow 테이블의 ID라면 App을 거쳐서 찾아야 함.
        # 여기서는 프론트엔드에서 App ID를 workflowId 필드에 저장한다고 가정하겠습니다. (또는 appId 필드 사용)
        target_app_id = self.data.appId  # 엔티티 정의에 appId가 있음

        app = db.query(App).filter(App.id == target_app_id).first()
        if not app:
            raise ValueError(f"[WorkflowNode] Target App {target_app_id} not found")

        if not app.active_deployment_id:
            raise ValueError(f"[WorkflowNode] App {app.name} has no active deployment")

        from apps.shared.db.models.workflow_deployment import WorkflowDeployment

        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == app.active_deployment_id)
            .first()
        )

        if not deployment:
            raise ValueError(
                f"[WorkflowNode] Active deployment not found for app {app.name}"
            )

        graph = deployment.graph_snapshot
        if not graph:
            raise ValueError(
                f"[WorkflowNode] Deployment {deployment.version} has no graph data"
            )

        # 2. 입력 매핑 처리 (Inputs Mapping)
        sub_workflow_inputs = {}
        for mapping in self.data.inputs:
            target_var = mapping.name
            selector = mapping.value_selector

            val = None
            if selector and len(selector) > 0:
                node_id = selector[0]
                source_data = inputs.get(node_id)

                if source_data is not None:
                    if len(selector) > 1:
                        val = _get_nested_value(source_data, selector[1:])
                    else:
                        val = source_data

            # 값이 없으면 None 또는 빈 문자열? (일단 None)
            sub_workflow_inputs[target_var] = val

        # 3. 서브 워크플로우 실행

        # is_deployed=True로 설정하여 AnswerNode의 결과만 반환받도록 함
        # user_id 등 context 전달
        # parent_run_id를 전달하여 서브 워크플로우의 노드 실행 기록이 부모 워크플로우와 연결되도록 함
        parent_run_id = self.execution_context.get("workflow_run_id")

        # [FIX] DB 세션을 명시적으로 전달하여 중첩 서브 워크플로우에서도 DB 접근 가능하도록 함
        engine = WorkflowEngine(
            graph,
            sub_workflow_inputs,
            execution_context=self.execution_context,
            is_deployed=True,
            db=db,  # [FIX] DB 세션 명시적 전달 (중첩 서브 워크플로우 지원)
            parent_run_id=parent_run_id,
            is_subworkflow=True,  # [FIX] 서브 워크플로우 표시 - Redis 이벤트 발행 스킵
        )

        # [FIX] 메모리 누수 방지:
        # - 서브 워크플로우 실행 후 명시적 cleanup
        # - asyncio.run() 대신 기존 이벤트 루프 재사용 (중첩 호출 시 루프 충돌 방지)
        try:
            # 기존 이벤트 루프가 있는지 확인
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # 이미 이벤트 루프가 실행 중인 경우 (Celery Worker 환경)
                # run_in_executor에서 호출되므로 새 루프 생성 필요
                new_loop = asyncio.new_event_loop()
                try:
                    result = new_loop.run_until_complete(engine.execute())
                finally:
                    new_loop.close()
            else:
                # 이벤트 루프가 없는 경우 (테스트 환경 등)
                result = asyncio.run(engine.execute())
        finally:
            engine.cleanup()

        # 출력 통일: 항상 'result' 키로 반환
        # 서브 워크플로우의 출력값 구조와 관계없이 일관된 출력 제공
        return {"result": result}
