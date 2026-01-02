"""
NodeFactory 테스트: 노드가 올바르게 생성되는지 검증
"""

import pytest

from schemas.workflow import NodeSchema, Position
from workflow.core.workflow_node_factory import NodeFactory
from workflow.nodes.base.entities import NodeStatus
from workflow.nodes.start import StartNode, StartNodeData
from workflow.nodes.start.start_node import WorkflowVariable


def test_factory_creates_start_node():
    """NodeFactory가 StartNode를 올바르게 생성하는지 테스트"""
    # Given
    schema = NodeSchema(
        id="node-1",
        type="startNode",
        position=Position(x=0, y=0),
        data={"title": "시작 노드", "trigger_type": "manual"},
    )

    # When
    node = NodeFactory.create(schema)

    # Then
    assert isinstance(node, StartNode)
    assert node.id == "node-1"
    assert node.data.title == "시작 노드"
    assert node.data.trigger_type == "manual"
    assert node.status == NodeStatus.IDLE
    assert node.node_type == "startNode"


def test_factory_raises_error_for_unimplemented_node():
    """등록되지 않은 노드 타입에 대해 NotImplementedError 발생하는지 테스트"""
    # Given
    schema = NodeSchema(
        id="node-2",
        type="unknown_type",
        position=Position(x=100, y=100),
        data={"title": "미구현 노드"},
    )

    # When & Then
    with pytest.raises(NotImplementedError) as exc_info:
        NodeFactory.create(schema)

    assert "unknown_type" in str(exc_info.value)
    assert "not implemented" in str(exc_info.value).lower()


def test_factory_handles_missing_data_fields():
    """필수 필드 누락 시 적절한 에러가 발생하는지 테스트"""
    # Given
    schema = NodeSchema(
        id="node-3",
        type="startNode",
        position=Position(x=0, y=0),
        data={},  # title이 없음 (필수 필드)
    )

    # When & Then
    with pytest.raises(Exception):  # Pydantic ValidationError 발생 예상
        NodeFactory.create(schema)


def test_factory_uses_default_values():
    """NodeData의 기본값이 올바르게 적용되는지 테스트"""
    # Given
    schema = NodeSchema(
        id="node-4",
        type="startNode",
        position=Position(x=0, y=0),
        data={"title": "기본값 테스트"},  # trigger_type 생략
    )

    # When
    node = NodeFactory.create(schema)

    # Then
    assert isinstance(node, StartNode)
    assert node.data.trigger_type == "manual"  # 기본값 확인


def test_factory_node_is_executable():
    """Factory로 생성된 노드가 실행 가능한지 테스트"""
    # Given
    schema = NodeSchema(
        id="node-5",
        type="startNode",
        position=Position(x=0, y=0),
        data={
            "title": "실행 테스트",
            "variables": [
                WorkflowVariable(
                    id="var-1", name="user_query", type="text", label="User Query"
                )
            ],
        },
    )
    node = NodeFactory.create(schema)

    test_inputs = {"user_query": "Hello"}

    # When
    outputs = node.execute(test_inputs)

    # Then
    assert outputs["user_query"] == test_inputs["user_query"]
    assert outputs["var-1"] == test_inputs["user_query"]
    assert node.status == NodeStatus.COMPLETED


def test_factory_registry_contains_start_node():
    """NODE_REGISTRY에 start 노드가 등록되어 있는지 확인"""
    # Then
    assert "startNode" in NodeFactory.NODE_REGISTRY
    assert NodeFactory.NODE_REGISTRY["startNode"] == (StartNode, StartNodeData)


def test_factory_creates_multiple_nodes():
    """여러 노드를 연속으로 생성해도 독립적인지 테스트"""
    # Given
    schema1 = NodeSchema(
        id="node-1",
        type="startNode",
        position=Position(x=0, y=0),
        data={"title": "첫 번째"},
    )
    schema2 = NodeSchema(
        id="node-2",
        type="startNode",
        position=Position(x=100, y=0),
        data={"title": "두 번째"},
    )

    # When
    node1 = NodeFactory.create(schema1)
    node2 = NodeFactory.create(schema2)

    # Then
    assert node1.id != node2.id
    assert node1.data.title != node2.data.title
    assert node1 is not node2  # 서로 다른 인스턴스
