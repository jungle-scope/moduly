from typing import Any, Dict, List
import uuid

from workflow.nodes.base.node import Node
from .entities import WorkflowNodeData
from services.workflow_service import WorkflowService
# Note: Import WorkflowEngine inside method to avoid circular import if possible, 
# but WorkflowEngine depends on NodeFactory which depends on Node... 
# Circular dependency is likely.
# We will handle import inside _run.


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
        from workflow.core.workflow_engine import WorkflowEngine

        workflow_id = self.data.workflowId
        db = self.execution_context.get("db")
        if not db:
            raise ValueError(f"[WorkflowNode] DB session required in execution_context for node {self.id}")

        # 1. 대상 워크플로우 그래프 로드
        # draft 모드에서도 테스트 가능하도록 get_draft 사용 (혹은 실행 모드에 따라 분기 가능)
        # 여기서는 편의상 draft를 로드 (최신 편집본 실행)
        # TODO: 프로덕션 배포 시에는 'published' 버전을 로드해야 함
        graph = WorkflowService.get_draft(db, workflow_id)
        if not graph:
            raise ValueError(f"[WorkflowNode] Target workflow {workflow_id} not found")

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
        print(f"[WorkflowNode] Executing sub-workflow {workflow_id} with inputs: {sub_workflow_inputs}")
        
        # is_deployed=True로 설정하여 AnswerNode의 결과만 반환받도록 함
        # user_id 등 context 전달
        engine = WorkflowEngine(
            graph, 
            sub_workflow_inputs, 
            execution_context=self.execution_context, 
            is_deployed=True 
        )
        
        result = engine.execute()
        
        print(f"[WorkflowNode] Sub-workflow result: {result}")
        return result
