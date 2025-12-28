from typing import Any, Dict

from pydantic import Field

from workflow.core.entities import BaseNodeData
from workflow.core.node import Node


class StartNodeData(BaseNodeData):
    """
    Start Node만의 특별한 설정이 있다면 여기에 정의합니다.
    (예: 트리거 방식 등)
    """

    trigger_type: str = Field(
        "manual", description="실행 트리거 방식 (manual, webhook 등)"
    )


class StartNode(Node[StartNodeData]):
    """
    워크플로우의 시작점입니다.
    사용자 입력을 그대로 다음 노드로 전달하는 역할을 합니다.
    """

    node_type = "startNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        # Start Node는 복잡한 로직 없이
        # 들어온 입력을 그대로 출력으로 내보냅니다.
        # (필요하다면 여기서 필수 입력값 검증 로직을 추가할 수 있습니다.)
        print(f"[{self.data.title}] 사용자 입력 수신: {inputs}")
        return inputs
