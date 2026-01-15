"""
WorkflowNode 테스트

워크플로우 내에서 다른 워크플로우를 실행하는 WorkflowNode의 동작을 테스트합니다.
"""

from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

from apps.workflow_engine.workflow.nodes.base.entities import NodeStatus
from apps.workflow_engine.workflow.nodes.workflow import WorkflowNode
from apps.workflow_engine.workflow.nodes.workflow.entities import (
    WorkflowNodeData,
    WorkflowNodeInput,
)


def test_workflow_node_initialization():
    """WorkflowNode가 올바르게 초기화되는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="서브 워크플로우 실행",
        workflowId="workflow-123",
        appId="app-456",
        inputs=[
            WorkflowNodeInput(name="query", value_selector=["node-1", "output"]),
            WorkflowNodeInput(name="context", value_selector=["node-2", "text"]),
        ],
    )

    # When
    node = WorkflowNode(id="workflow-node-1", data=node_data)

    # Then
    assert node.id == "workflow-node-1"
    assert node.data.title == "서브 워크플로우 실행"
    assert node.data.workflowId == "workflow-123"
    assert node.data.appId == "app-456"
    assert len(node.data.inputs) == 2
    assert node.status == NodeStatus.IDLE
    assert node.node_type == "workflowNode"


def test_workflow_node_execution_with_input_mapping():
    """WorkflowNode가 입력 매핑을 적용하여 서브 워크플로우를 실행하는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="텍스트 처리 모듈",
        workflowId="workflow-abc",
        appId="app-xyz",
        inputs=[
            WorkflowNodeInput(name="input_text", value_selector=["start-node", "text"]),
            WorkflowNodeInput(name="language", value_selector=["config-node", "lang"]),
        ],
    )
    node = WorkflowNode(id="wf-node-1", data=node_data)

    # Mock DB and models
    mock_db = MagicMock()
    mock_app = Mock()
    mock_app.id = "app-xyz"
    mock_app.name = "Text Processor"
    mock_app.active_deployment_id = "deploy-1"

    mock_deployment = Mock()
    mock_deployment.id = "deploy-1"
    mock_deployment.version = "v1.0"
    mock_deployment.graph_snapshot = {
        "nodes": [
            {
                "id": "start",
                "type": "startNode",
                "position": {"x": 0, "y": 0},
                "data": {"title": "Start"},
            }
        ],
        "edges": [],
    }

    # Mock query chain
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_app,
        mock_deployment,
    ]

    # Mock WorkflowEngine
    with patch(
        "apps.workflow_engine.workflow.core.workflow_engine.WorkflowEngine"
    ) as MockEngine:
        mock_engine_instance = MockEngine.return_value
        mock_engine_instance.execute = AsyncMock(
            return_value={
                "answer": "처리 완료",
                "processed_text": "HELLO WORLD",
            }
        )

        # Execution context
        node.execution_context = {"db": mock_db, "user_id": "user-1"}

        # Input from previous nodes
        inputs = {
            "start-node": {"text": "Hello World", "timestamp": "2026-01-02"},
            "config-node": {"lang": "en", "mode": "basic"},
        }

        # When
        result = node.execute(inputs)

        # Then
        # 1. App과 Deployment 조회 확인
        assert mock_db.query.call_count == 2

        # 2. WorkflowEngine이 올바른 인자로 초기화되었는지 확인
        MockEngine.assert_called_once()
        call_args = MockEngine.call_args
        assert call_args[0][0] == mock_deployment.graph_snapshot
        assert call_args[0][1] == {"input_text": "Hello World", "language": "en"}
        assert call_args[1]["execution_context"] == node.execution_context
        assert call_args[1]["is_deployed"] is True

        # 3. 실행 결과 확인 (WorkflowNode는 {"result": ...} 형태로 반환)
        assert result["result"]["answer"] == "처리 완료"
        assert result["result"]["processed_text"] == "HELLO WORLD"

        # 4. 상태가 COMPLETED로 변경되었는지 확인
        assert node.status == NodeStatus.COMPLETED


def test_workflow_node_error_no_db_session():
    """DB 세션이 없을 때 ValueError를 발생시키는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="에러 테스트", workflowId="wf-1", appId="app-1", inputs=[]
    )
    node = WorkflowNode(id="node-1", data=node_data)
    node.execution_context = {}  # DB 세션 없음

    # When / Then
    with pytest.raises(ValueError, match="DB session required"):
        node.execute({})


def test_workflow_node_error_app_not_found():
    """타겟 App을 찾을 수 없을 때 ValueError를 발생시키는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="App 없음", workflowId="wf-1", appId="nonexistent-app", inputs=[]
    )
    node = WorkflowNode(id="node-1", data=node_data)

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None  # App 없음

    node.execution_context = {"db": mock_db}

    # When / Then
    with pytest.raises(ValueError, match="Target App .* not found"):
        node.execute({})


def test_workflow_node_error_no_active_deployment():
    """활성 배포가 없을 때 ValueError를 발생시키는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="배포 없음", workflowId="wf-1", appId="app-1", inputs=[]
    )
    node = WorkflowNode(id="node-1", data=node_data)

    mock_db = MagicMock()
    mock_app = Mock()
    mock_app.id = "app-1"
    mock_app.name = "Test App"
    mock_app.active_deployment_id = None  # 활성 배포 없음

    mock_db.query.return_value.filter.return_value.first.return_value = mock_app

    node.execution_context = {"db": mock_db}

    # When / Then
    with pytest.raises(ValueError, match="has no active deployment"):
        node.execute({})


def test_workflow_node_nested_value_extraction():
    """중첩된 값 선택자가 올바르게 동작하는지 테스트합니다."""
    # Given
    node_data = WorkflowNodeData(
        title="중첩 값 테스트",
        workflowId="wf-1",
        appId="app-1",
        inputs=[
            WorkflowNodeInput(
                name="user_name", value_selector=["user-node", "profile", "name"]
            ),
            WorkflowNodeInput(
                name="user_age", value_selector=["user-node", "profile", "age"]
            ),
        ],
    )
    node = WorkflowNode(id="node-1", data=node_data)

    # Mock DB
    mock_db = MagicMock()
    mock_app = Mock()
    mock_app.active_deployment_id = "deploy-1"
    mock_deployment = Mock()
    mock_deployment.graph_snapshot = {
        "nodes": [
            {
                "id": "start",
                "type": "startNode",
                "position": {"x": 0, "y": 0},
                "data": {"title": "Start"},
            }
        ],
        "edges": [],
    }

    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_app,
        mock_deployment,
    ]

    with patch(
        "apps.workflow_engine.workflow.core.workflow_engine.WorkflowEngine"
    ) as MockEngine:
        mock_engine_instance = MockEngine.return_value
        mock_engine_instance.execute = AsyncMock(return_value={"result": "OK"})

        node.execution_context = {"db": mock_db}
        inputs = {
            "user-node": {"profile": {"name": "Alice", "age": 30, "city": "Seoul"}}
        }

        # When
        node.execute(inputs)

        # Then
        call_args = MockEngine.call_args
        sub_workflow_inputs = call_args[0][1]
        assert sub_workflow_inputs["user_name"] == "Alice"
        assert sub_workflow_inputs["user_age"] == 30
