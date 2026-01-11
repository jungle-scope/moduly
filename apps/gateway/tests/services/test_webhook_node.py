import unittest

from workflow.nodes.webhook.entities import VariableMapping, WebhookTriggerNodeData
from workflow.nodes.webhook.webhook_node import WebhookTriggerNode


class TestWebhookTriggerNode(unittest.TestCase):
    def test_extract_value_simple(self):
        """단순 JSON Path 값 추출 테스트"""
        node = WebhookTriggerNode(
            id="test-node",
            data=WebhookTriggerNodeData(title="Test", provider="custom"),
        )

        payload = {"key": "value", "number": 123}

        self.assertEqual(node._extract_value(payload, "key"), "value")
        self.assertEqual(node._extract_value(payload, "number"), 123)
        self.assertIsNone(node._extract_value(payload, "missing"))

    def test_extract_value_nested(self):
        """중첩된 JSON Path 값 추출 테스트"""
        node = WebhookTriggerNode(
            id="test-node",
            data=WebhookTriggerNodeData(title="Test", provider="custom"),
        )

        payload = {
            "issue": {"fields": {"summary": "Test Issue", "project": {"key": "TEST"}}}
        }

        self.assertEqual(
            node._extract_value(payload, "issue.fields.summary"), "Test Issue"
        )
        self.assertEqual(
            node._extract_value(payload, "issue.fields.project.key"), "TEST"
        )
        self.assertIsNone(node._extract_value(payload, "issue.missing.key"))

    def test_run_variable_mapping(self):
        """Variable Mapping 적용 테스트"""
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
        result = node.execute(payload)

        # 검증
        self.assertEqual(result["summary"], "Bug Report")
        self.assertEqual(result["project_key"], "JUNGLE")


if __name__ == "__main__":
    unittest.main()
