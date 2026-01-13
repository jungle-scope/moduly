"""Webhook Trigger Node"""

from typing import Any, Dict

from apps.workflow_engine.nodes.base.node import Node
from apps.workflow_engine.nodes.webhook.entities import WebhookTriggerNodeData


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
        지원 형식: key.subkey, array[0], array[0].key

        Args:
            data: Payload JSON
            path: 점(.) 구분자로 된 경로 (예: "issue.fields.summary", "items[0].name")

        Returns:
            추출된 값 (없으면 None)
        """
        import re

        try:
            # 점(.)으로 분리하되, 대괄호 내부의 점은 무시하는 등 복잡한 로직이 필요할 수 있으나
            # 현재는 단순 점 분리 후 각 파트에서 인덱싱 처리를 수행
            keys = path.split(".")
            current = data

            for key in keys:
                # 배열 인덱싱 처리: key[0], items[10] 등
                match = re.match(r"(.+)\[(\d+)\]$", key)
                if match:
                    key_name = match.group(1)
                    index = int(match.group(2))

                    if isinstance(current, dict) and key_name in current:
                        current = current[key_name]
                        if isinstance(current, list) and 0 <= index < len(current):
                            current = current[index]
                        else:
                            return None  # 리스트가 아니거나 인덱스 범위 초과
                    else:
                        return None  # 키가 없음
                else:
                    # 일반 딕셔너리 키 접근
                    if isinstance(current, dict) and key in current:
                        current = current[key]
                    else:
                        return None  # 경로가 존재하지 않음

            return current
        except Exception:
            return None
