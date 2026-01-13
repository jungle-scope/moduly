"""조건 분기 노드 구현 - Multi-Branch 지원"""

from typing import Any, Dict, List

from apps.workflow_engine.core.utils import get_nested_value
from apps.workflow_engine.nodes.base.node import Node

from .entities import Condition, ConditionCase, ConditionNodeData, ConditionOperator


class ConditionNode(Node[ConditionNodeData]):
    """
    조건을 평가하여 워크플로우 흐름을 분기시키는 노드입니다.
    여러 분기 케이스를 순차적으로 평가하여 첫 번째로 만족하는 케이스의 핸들로 분기합니다.
    어떤 케이스도 만족하지 않으면 'else' 핸들로 분기합니다.
    """

    node_type = "conditionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        설정된 케이스들을 순차적으로 평가하고 선택된 분기 핸들을 반환합니다.

        Args:
            inputs: 이전 노드들의 실행 결과

        Returns:
            {
                "matched_case_id": str | None,  # 매칭된 케이스 ID
                "selected_handle": str          # 케이스 ID 또는 "else"
            }
        """
        cases = self._get_cases()

        print(f"[{self.data.title}] 조건 평가 시작 (케이스 수: {len(cases)})")

        for case in cases:
            case_result = self._evaluate_case(case, inputs)
            print(f"  - 케이스 '{case.case_name or case.id}': {case_result}")

            if case_result:
                print(f"[{self.data.title}] 선택된 핸들: {case.id}")
                return {
                    "result": True,
                    "matched_case_id": case.id,
                    "selected_handle": case.id,
                }

        print(f"[{self.data.title}] 매칭된 케이스 없음, 선택된 핸들: default")
        return {
            "result": False,
            "matched_case_id": None,
            "selected_handle": "default",
        }

    def _get_cases(self) -> List[ConditionCase]:
        """
        케이스 목록을 반환합니다.
        하위 호환성을 위해 레거시 conditions 필드도 지원합니다.
        """
        # 새로운 cases 필드가 있으면 사용
        if self.data.cases:
            return self.data.cases

        # 레거시: 기존 conditions 필드가 있으면 하나의 케이스로 변환
        if self.data.conditions:
            legacy_case = ConditionCase(
                id="true",  # 기존 동작과 호환: 조건 만족 시 "true"
                case_name="True",
                conditions=self.data.conditions,
                logical_operator=self.data.logical_operator or "and",
            )
            return [legacy_case]

        return []

    def _evaluate_case(self, case: ConditionCase, inputs: Dict[str, Any]) -> bool:
        """단일 케이스의 모든 조건을 평가합니다."""
        if not case.conditions:
            # 조건이 없으면 항상 참 (catch-all)
            return True

        results = []
        for condition in case.conditions:
            result = self._evaluate_condition(condition, inputs)
            results.append(result)

        # 논리 연산자로 결과 결합
        if case.logical_operator == "and":
            return all(results)
        else:  # "or"
            return any(results)

    def _evaluate_condition(self, condition: Condition, inputs: Dict[str, Any]) -> bool:
        """단일 조건을 평가합니다."""
        # variable_selector에서 값 추출
        if len(condition.variable_selector) < 1:
            print("  경고: 빈 variable_selector")
            return False

        node_id = condition.variable_selector[0]
        source_data = inputs.get(node_id)

        if source_data is None:
            actual_value = None
        elif len(condition.variable_selector) > 1:
            actual_value = get_nested_value(
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

        def safe_float(value: Any) -> float:
            """안전하게 float으로 변환"""
            if value is None:
                raise ValueError("None cannot be converted to float")
            return float(value)

        def values_equal(a: Any, b: Any) -> bool:
            """타입 변환을 지원하는 동등 비교"""
            if a == b:
                return True

            # Boolean 처리: 문자열 "true"/"false" (대소문자 무시) 처리
            def is_bool_like(v):
                return isinstance(v, bool) or (
                    isinstance(v, str) and v.lower() in ("true", "false")
                )

            def get_bool(v):
                if isinstance(v, bool):
                    return v
                return v.lower() == "true"

            if is_bool_like(a) and is_bool_like(b):
                return get_bool(a) == get_bool(b)

            try:
                return safe_float(a) == safe_float(b)
            except (ValueError, TypeError):
                return str(a) == str(b)

        try:
            if operator == ConditionOperator.EQUALS:
                return values_equal(actual, expected)

            elif operator == ConditionOperator.NOT_EQUALS:
                return not values_equal(actual, expected)

            elif operator == ConditionOperator.CONTAINS:
                return str(expected) in str(actual) if actual is not None else False

            elif operator == ConditionOperator.NOT_CONTAINS:
                return str(expected) not in str(actual) if actual is not None else True

            elif operator == ConditionOperator.STARTS_WITH:
                return (
                    str(actual).startswith(str(expected))
                    if actual is not None
                    else False
                )

            elif operator == ConditionOperator.ENDS_WITH:
                return (
                    str(actual).endswith(str(expected)) if actual is not None else False
                )

            elif operator == ConditionOperator.IS_EMPTY:
                return (
                    actual is None
                    or actual == ""
                    or actual == []
                    or actual == {}
                    or actual == 0
                )

            elif operator == ConditionOperator.IS_NOT_EMPTY:
                return (
                    actual is not None
                    and actual != ""
                    and actual != []
                    and actual != {}
                    and actual != 0
                )

            elif operator == ConditionOperator.GREATER_THAN:
                if actual is None:
                    return False
                return safe_float(actual) > safe_float(expected)

            elif operator == ConditionOperator.LESS_THAN:
                if actual is None:
                    return False
                return safe_float(actual) < safe_float(expected)

            elif operator == ConditionOperator.GREATER_THAN_OR_EQUALS:
                if actual is None:
                    return False
                return safe_float(actual) >= safe_float(expected)

            elif operator == ConditionOperator.LESS_THAN_OR_EQUALS:
                if actual is None:
                    return False
                return safe_float(actual) <= safe_float(expected)

            else:
                print(f"  경고: 알 수 없는 연산자 '{operator}'")
                return False

        except (ValueError, TypeError) as e:
            print(f"  경고: 비교 중 오류 발생 - {e}")
            return False
