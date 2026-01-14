from typing import Dict

from apps.shared.schemas.workflow import NodeSchema
from apps.workflow_engine.workflow.nodes.answer import AnswerNode, AnswerNodeData
from apps.workflow_engine.workflow.nodes.base.node import Node
from apps.workflow_engine.workflow.nodes.code import CodeNode, CodeNodeData
from apps.workflow_engine.workflow.nodes.condition import ConditionNode, ConditionNodeData
from apps.workflow_engine.workflow.nodes.file_extraction import FileExtractionNode, FileExtractionNodeData
from apps.workflow_engine.workflow.nodes.github import GithubNode, GithubNodeData
from apps.workflow_engine.workflow.nodes.http import HttpRequestNode, HttpRequestNodeData
from apps.workflow_engine.workflow.nodes.llm import LLMNode, LLMNodeData
from apps.workflow_engine.workflow.nodes.loop import LoopNode, LoopNodeData
from apps.workflow_engine.workflow.nodes.mail import MailNode, MailNodeData
from apps.workflow_engine.workflow.nodes.schedule import (
    ScheduleTriggerNode,
    ScheduleTriggerNodeData,
)
from apps.workflow_engine.workflow.nodes.start import StartNode, StartNodeData
from apps.workflow_engine.workflow.nodes.template.entities import TemplateNodeData
from apps.workflow_engine.workflow.nodes.template.template_node import TemplateNode
from apps.workflow_engine.workflow.nodes.webhook import WebhookTriggerNode, WebhookTriggerNodeData
from apps.workflow_engine.workflow.nodes.workflow.entities import WorkflowNodeData
from apps.workflow_engine.workflow.nodes.workflow.workflow_node import WorkflowNode


class NodeFactory:
    """
    NodeSchema를 실제 Node 인스턴스로 변환하는 Factory 클래스
    새로운 노드 타입 추가 시 NODE_REGISTRY에 등록만 하면 됨
    """

    # 노드 타입 → (NodeClass, DataClass) 매핑
    # 프론트엔드 React Flow 타입명과 일치해야 함
    NODE_REGISTRY: Dict[str, tuple] = {
        "startNode": (StartNode, StartNodeData),
        "webhookTrigger": (WebhookTriggerNode, WebhookTriggerNodeData),
        "scheduleTrigger": (ScheduleTriggerNode, ScheduleTriggerNodeData),
        "answerNode": (AnswerNode, AnswerNodeData),
        "codeNode": (CodeNode, CodeNodeData),
        "conditionNode": (ConditionNode, ConditionNodeData),
        "llmNode": (LLMNode, LLMNodeData),
        "httpRequestNode": (HttpRequestNode, HttpRequestNodeData),
        "slackPostNode": (HttpRequestNode, HttpRequestNodeData),
        "githubNode": (GithubNode, GithubNodeData),
        "mailNode": (MailNode, MailNodeData),
        "templateNode": (TemplateNode, TemplateNodeData),
        "workflowNode": (WorkflowNode, WorkflowNodeData),
        "fileExtractionNode": (FileExtractionNode, FileExtractionNodeData),
        "loopNode": (LoopNode, LoopNodeData),
    }

    @staticmethod
    def create(schema: NodeSchema, context: Dict = None) -> Node:
        """
        NodeSchema로부터 적절한 Node 인스턴스를 생성

        Args:
            schema: 노드 스키마 (타입, 데이터 등 포함)
            context: 실행 컨텍스트 (user_id 등)

        Returns:
            생성된 Node 인스턴스

        Raises:
            NotImplementedError: 등록되지 않은 노드 타입일 때
        """
        if schema.type not in NodeFactory.NODE_REGISTRY:
            raise NotImplementedError(
                f"Node type '{schema.type}' is not implemented yet. "
                f"Available types: {list(NodeFactory.NODE_REGISTRY.keys())}"
            )

        NodeClass, DataClass = NodeFactory.NODE_REGISTRY[schema.type]
        data = DataClass(**schema.data)
        return NodeClass(schema.id, data, execution_context=context)
