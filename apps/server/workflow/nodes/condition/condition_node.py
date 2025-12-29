"""조건 분기 노드 구현"""

from typing import Any, Dict, List

from workflow.nodes.base.node import Node

from .entities import Condition, ConditionNodeData, ConditionOperator


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    예: _get_nested_value({"a": {"b": "c"}}, ["a", "b"]) -> "c"
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class ConditionNode(Node[ConditionNodeData]):
    """
    조건을 평가하여 워크플로우 흐름을 분기시키는 노드입니다.
    조건 평가 결과에 따라 'true' 또는 'false' 핸들로 분기합니다.
    """

    node_type = "conditionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        설정된 조건들을 평가하고 선택된 분기 핸들을 반환합니다.

        Args:
            inputs: 이전 노드들의 실행 결과

        Returns:
            {
                "result": bool,           # 조건 평가 결과
                "selected_handle": str    # "true" 또는 "false"
            }
        """
        results = []

        print(f"[{self.data.title}] 조건 평가 시작 (조건 수: {len(self.data.conditions)})")

        for condition in self.data.conditions:
            result = self._evaluate_condition(condition, inputs)
            results.append(result)
            print(f"  - 조건 '{condition.id}': {result}")

        # 논리 연산자로 결과 결합
        if self.data.logical_operator == "and":
            final_result = all(results) if results else False
        else:  # "or"
            final_result = any(results) if results else False

        selected_handle = "true" if final_result else "false"
        print(f"[{self.data.title}] 최종 결과: {final_result}, 선택된 핸들: {selected_handle}")

        return {
            "result": final_result,
            "selected_handle": selected_handle,
        }

    def _evaluate_condition(self, condition: Condition, inputs: Dict[str, Any]) -> bool:
        """단일 조건을 평가합니다."""
        # variable_selector에서 값 추출
        if len(condition.variable_selector) < 1:
            print(f"  경고: 빈 variable_selector")
            return False

        node_id = condition.variable_selector[0]
        source_data = inputs.get(node_id)

        if source_data is None:
            actual_value = None
        elif len(condition.variable_selector) > 1:
            actual_value = _get_nested_value(
                source_data, condition.variable_selector[1:]
            )
        else:
            actual_value = source_data

        # 연산자별 평가
        return self._apply_operator(condition.operator, actual_value, condition.value)

    def _apply_operator(
        self, operator: ConditionOperator, actual: Any, expected: Any
    ) -> bool:
        """연산자에 따른 비교를 수행합니다."""
        try:
            if operator == ConditionOperator.EQUALS:
                return actual == expected

            elif operator == ConditionOperator.NOT_EQUALS:
                return actual != expected

            elif operator == ConditionOperator.CONTAINS:
                return expected in str(actual) if actual is not None else False

            elif operator == ConditionOperator.NOT_CONTAINS:
                return expected not in str(actual) if actual is not None else True

            elif operator == ConditionOperator.STARTS_WITH:
                return str(actual).startswith(str(expected)) if actual is not None else False

            elif operator == ConditionOperator.ENDS_WITH:
                return str(actual).endswith(str(expected)) if actual is not None else False

            elif operator == ConditionOperator.IS_EMPTY:
                return actual is None or actual == "" or actual == [] or actual == {}

            elif operator == ConditionOperator.IS_NOT_EMPTY:
                return actual is not None and actual != "" and actual != [] and actual != {}

            elif operator == ConditionOperator.GREATER_THAN:
                return float(actual) > float(expected) if actual is not None else False

            elif operator == ConditionOperator.LESS_THAN:
                return float(actual) < float(expected) if actual is not None else False

            elif operator == ConditionOperator.GREATER_THAN_OR_EQUALS:
                return float(actual) >= float(expected) if actual is not None else False

            elif operator == ConditionOperator.LESS_THAN_OR_EQUALS:
                return float(actual) <= float(expected) if actual is not None else False

            else:
                print(f"  경고: 알 수 없는 연산자 '{operator}'")
                return False

        except (ValueError, TypeError) as e:
            print(f"  경고: 비교 중 오류 발생 - {e}")
            return False
