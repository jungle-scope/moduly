"""Webhook Trigger Node"""

from typing import Any, Dict

from workflow.nodes.base.node import Node
from workflow.nodes.webhook.entities import WebhookTriggerNodeData


class WebhookTriggerNode(Node[WebhookTriggerNodeData]):
    """
    외부 웹훅으로 워크플로우를 시작하는 노드.
    Jira, Slack 등의 외부 서비스에서 전송한 Payload를 파싱하여 다음 노드로 전달합니다.
    """

    node_type = "webhookTrigger"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Webhook Payload를 받아서 변수 매핑에 따라 데이터를 추출합니다.

        Args:
            inputs: Webhook Payload (JSON)

        Returns:
            매핑된 변수들의 딕셔너리
        """
        result = {}

        # Variable Mapping에 따라 Payload에서 값 추출
        for mapping in self.data.variable_mappings:
            value = self._extract_value(inputs, mapping.json_path)

            # ID와 Name 모두로 매핑 (다른 노드들과의 호환성)
            result[mapping.variable_name] = value

        return result

    def _extract_value(self, data: Dict[str, Any], path: str) -> Any:
        """
        JSON Path 문자열을 파싱하여 값을 추출합니다.

        Args:
            data: Payload JSON
            path: 점(.) 구분자로 된 경로 (예: "issue.fields.summary")

        Returns:
            추출된 값 (없으면 None)
        """
        keys = path.split(".")
        current = data

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None  # 경로가 존재하지 않음

        return current
