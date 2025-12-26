from typing import Dict

from schemas.workflow import NodeSchema
from workflow.core.node import Node
from workflow.nodes.start import StartNode, StartNodeData


class NodeFactory:
    """
    NodeSchema를 실제 Node 인스턴스로 변환하는 Factory 클래스
    새로운 노드 타입 추가 시 NODE_REGISTRY에 등록만 하면 됨
    """

    # 노드 타입 → (NodeClass, DataClass) 매핑
    NODE_REGISTRY: Dict[str, tuple] = {
        "start": (StartNode, StartNodeData),
        # TODO: 추가 노드 타입 등록
        # "llm": (LLMNode, LLMNodeData),
        # "code": (CodeNode, CodeNodeData),
        # "end": (EndNode, EndNodeData),
    }

    @staticmethod
    def create(schema: NodeSchema) -> Node:
        """
        NodeSchema로부터 적절한 Node 인스턴스를 생성

        Args:
            schema: 노드 스키마 (타입, 데이터 등 포함)

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
        return NodeClass(schema.id, data)
