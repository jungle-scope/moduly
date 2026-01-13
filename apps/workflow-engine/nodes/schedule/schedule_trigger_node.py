"""Schedule Trigger Node"""

from typing import Any, Dict

from apps.workflow_engine.nodes.base.node import Node
from apps.workflow_engine.nodes.schedule.entities import ScheduleTriggerNodeData


class ScheduleTriggerNode(Node[ScheduleTriggerNodeData]):
    """
    특정 시간에 워크플로우를 자동으로 시작하는 노드.

    동작 방식:
    - 배포 시 Schedule 레코드 생성 → APScheduler에 등록
    - 지정된 시간에 APScheduler가 자동으로 워크플로우 실행
    - 이 노드는 워크플로우의 시작점 역할 (StartNode, WebhookTrigger와 유사)

    입력:
    - triggered_at: 스케줄러가 실행한 시간 (ISO 8601 형식)
    - schedule_id: 실행한 스케줄의 ID

    출력:
    - 실행 메타데이터 (다음 노드에서 참조 가능)
    """

    node_type = "scheduleTrigger"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        스케줄러가 전달한 입력을 그대로 다음 노드로 전달합니다.

        Args:
            inputs: 스케줄러가 전달한 메타데이터

        Returns:
            입력 그대로 반환
        """
        return inputs
