import logging
from typing import Any, Dict

from apps.workflow_engine.workflow.core.utils import get_nested_value
from apps.workflow_engine.workflow.nodes.base.node import Node

from .entities import AnswerNodeData

logger = logging.getLogger(__name__)


class AnswerNode(Node[AnswerNodeData]):
    """
    워크플로우의 최종 결과를 수집하는 노드입니다.
    상위 노드들의 실행 결과에서 필요한 값을 추출하여 최종 결과(Dict)를 생성합니다.
    """

    node_type = "answerNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        설정된 outputs에 따라 값을 수집하여 반환합니다.

        Args:
            inputs: 상위 노드들의 실행 결과가 담긴 Dictionary.
                    구조: { "node_id": { "result_key": "value", ... }, ... }

        Returns:
            최종 수집된 결과 Dictionary { "variable_name": "value", ... }
        """
        result = {}

        for output_config in self.data.outputs:
            variable_name = output_config.variable
            selector = output_config.value_selector

            # P2: 빈 변수명 검증
            if not variable_name or not variable_name.strip():
                logger.warning(f"[{self.data.title}] 빈 변수명 - 건너뜀")
                continue

            if not selector or len(selector) < 2:
                logger.warning(
                    f"[{self.data.title}] 잘못된 selector 형식 - {variable_name}"
                )
                result[variable_name] = None
                continue

            target_node_id = selector[0]

            # 1. inputs에서 target_node_id의 결과 찾기
            source_data = inputs.get(target_node_id)

            if source_data is None:
                logger.warning(
                    f"[{self.data.title}] 데이터를 찾을 수 없음 - Node: {target_node_id}"
                )
                result[variable_name] = None
                continue

            # 2. P5: 깊은 중첩 selector 지원 (selector[1:] 사용)
            if isinstance(source_data, dict):
                value = get_nested_value(source_data, selector[1:])
                result[variable_name] = value
            else:
                logger.warning(
                    f"[{self.data.title}] 소스 데이터가 Dict가 아님 - {target_node_id}"
                )
                result[variable_name] = source_data

        return result
