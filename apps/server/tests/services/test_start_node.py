from workflow.nodes.base.entities import NodeStatus
from workflow.nodes.start import StartNode, StartNodeData


def test_start_node_initialization():
    """StartNode가 올바르게 초기화되는지 테스트합니다."""
    # Given
    node_data = StartNodeData(title="내 시작 노드", trigger_type="webhook")

    # When
    node = StartNode(id="node-1", data=node_data)

    # Then
    assert node.id == "node-1"
    assert node.data.title == "내 시작 노드"
    assert node.data.trigger_type == "webhook"
    assert node.status == NodeStatus.IDLE
    assert node.node_type == "startNode"


def test_start_node_execution():
    """StartNode가 입력을 그대로 반환하고 상태가 완료로 변경되는지 테스트합니다."""
    # Given
    node_data = StartNodeData(title="테스트 시작")
    node = StartNode(id="node-1", data=node_data)

    test_inputs = {"query": "Hello World", "user_id": 123}

    # When
    # execute() 메서드는 내부적으로 _run()을 호출하고 상태를 관리합니다.
    outputs = node.execute(test_inputs)

    # Then
    # 1. 입력값이 그대로 출력되었는지 확인 (StartNode의 역할)
    assert outputs == test_inputs
    assert outputs["query"] == "Hello World"

    # 2. 상태가 COMPLETED로 변경되었는지 확인
    assert node.status == NodeStatus.COMPLETED


def test_start_node_default_values():
    """필수값이 아닌 필드의 기본값 동작을 테스트합니다."""
    # Given
    # trigger_type을 따로 주지 않음
    node_data = StartNodeData(title="기본값 테스트")

    # Then
    assert node_data.trigger_type == "manual"  # 기본값 확인
