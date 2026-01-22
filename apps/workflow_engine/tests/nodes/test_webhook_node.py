import pytest

from apps.workflow_engine.workflow.nodes.webhook.entities import VariableMapping, WebhookTriggerNodeData
from apps.workflow_engine.workflow.nodes.webhook.webhook_node import WebhookTriggerNode


def test_extract_value_simple():
    """단순 JSON Path 값 추출 테스트"""
    node = WebhookTriggerNode(
        id="test-node",
        data=WebhookTriggerNodeData(title="Test", provider="custom"),
    )

    payload = {"key": "value", "number": 123}

    assert node._extract_value(payload, "key") == "value"
    assert node._extract_value(payload, "number") == 123
    assert node._extract_value(payload, "missing") is None


def test_extract_value_nested():
    """중첩된 JSON Path 값 추출 테스트"""
    node = WebhookTriggerNode(
        id="test-node",
        data=WebhookTriggerNodeData(title="Test", provider="custom"),
    )

    payload = {
        "issue": {"fields": {"summary": "Test Issue", "project": {"key": "TEST"}}}
    }

    assert node._extract_value(payload, "issue.fields.summary") == "Test Issue"
    assert node._extract_value(payload, "issue.fields.project.key") == "TEST"
    assert node._extract_value(payload, "issue.missing.key") is None


@pytest.mark.asyncio
async def test_run_variable_mapping():
    """Variable Mapping 적용 테스트 (비동기)"""
    # 설정: summary와 project_key를 추출하도록 매핑
    data = WebhookTriggerNodeData(
        title="Test Mapped",
        provider="jira",
        variable_mappings=[
            VariableMapping(
                variable_name="summary", json_path="issue.fields.summary"
            ),
            VariableMapping(
                variable_name="project_key", json_path="issue.fields.project.key"
            ),
        ],
    )

    node = WebhookTriggerNode(id="test-node", data=data)

    # 입력 Payload
    payload = {
        "issue": {"fields": {"summary": "Bug Report", "project": {"key": "JUNGLE"}}}
    }

    # 실행
    result = await node.execute(payload)

    # 검증
    assert result["summary"] == "Bug Report"
    assert result["project_key"] == "JUNGLE"

