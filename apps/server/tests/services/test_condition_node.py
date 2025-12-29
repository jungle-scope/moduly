"""ConditionNode 테스트 - Multi-Branch 지원"""

import pytest

from workflow.nodes.base.entities import NodeStatus
from workflow.nodes.condition import ConditionNode, ConditionNodeData, ConditionCase
from workflow.nodes.condition.entities import Condition, ConditionOperator


class TestConditionNodeInitialization:
    """ConditionNode 초기화 테스트"""

    def test_basic_initialization_with_cases(self):
        """새로운 cases 기반 초기화가 올바르게 동작하는지 테스트"""
        node_data = ConditionNodeData(
            title="테스트 조건 노드",
            cases=[
                ConditionCase(
                    id="case-1",
                    case_name="First Case",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "value"],
                            operator=ConditionOperator.EQUALS,
                            value="test",
                        )
                    ],
                    logical_operator="and",
                )
            ],
        )

        node = ConditionNode(id="cond-node-1", data=node_data)

        assert node.id == "cond-node-1"
        assert node.data.title == "테스트 조건 노드"
        assert len(node.data.cases) == 1
        assert node.data.cases[0].case_name == "First Case"
        assert node.status == NodeStatus.IDLE
        assert node.node_type == "conditionNode"

    def test_legacy_conditions_backward_compatibility(self):
        """레거시 conditions 필드 하위 호환성 테스트"""
        node_data = ConditionNodeData(
            title="레거시 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "value"],
                    operator=ConditionOperator.EQUALS,
                    value="test",
                )
            ],
            logical_operator="and",
        )

        node = ConditionNode(id="test", data=node_data)
        inputs = {"node-1": {"value": "test"}}
        result = node.execute(inputs)

        # 레거시 모드에서는 "true" 핸들 반환
        assert result["selected_handle"] == "true"


class TestConditionNodeMultiBranch:
    """Multi-Branch 조건 평가 테스트"""

    def test_first_matching_case_selected(self):
        """첫 번째 매칭 케이스가 선택되는지 테스트"""
        node_data = ConditionNodeData(
            title="Multi-Branch 테스트",
            cases=[
                ConditionCase(
                    id="case-high",
                    case_name="High",
                    conditions=[
                        Condition(
                            id="c1",
                            variable_selector=["node-1", "score"],
                            operator=ConditionOperator.GREATER_THAN,
                            value=80,
                        )
                    ],
                ),
                ConditionCase(
                    id="case-medium",
                    case_name="Medium",
                    conditions=[
                        Condition(
                            id="c2",
                            variable_selector=["node-1", "score"],
                            operator=ConditionOperator.GREATER_THAN,
                            value=50,
                        )
                    ],
                ),
                ConditionCase(
                    id="case-low",
                    case_name="Low",
                    conditions=[
                        Condition(
                            id="c3",
                            variable_selector=["node-1", "score"],
                            operator=ConditionOperator.GREATER_THAN,
                            value=0,
                        )
                    ],
                ),
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        # 90점 -> case-high 선택
        result = node.execute({"node-1": {"score": 90}})
        assert result["selected_handle"] == "case-high"
        assert result["matched_case_id"] == "case-high"

        # 60점 -> case-medium 선택 (첫 번째 매칭)
        result = node.execute({"node-1": {"score": 60}})
        assert result["selected_handle"] == "case-medium"

        # 30점 -> case-low 선택
        result = node.execute({"node-1": {"score": 30}})
        assert result["selected_handle"] == "case-low"

    def test_else_when_no_match(self):
        """매칭되는 케이스가 없으면 else 선택"""
        node_data = ConditionNodeData(
            title="Else 테스트",
            cases=[
                ConditionCase(
                    id="case-1",
                    case_name="Only High",
                    conditions=[
                        Condition(
                            id="c1",
                            variable_selector=["node-1", "score"],
                            operator=ConditionOperator.GREATER_THAN,
                            value=90,
                        )
                    ],
                ),
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        # 50점 -> 매칭 없음 -> else
        result = node.execute({"node-1": {"score": 50}})
        assert result["selected_handle"] == "default"
        assert result["matched_case_id"] is None

    def test_empty_conditions_always_true(self):
        """조건이 없는 케이스는 항상 참 (catch-all)"""
        node_data = ConditionNodeData(
            title="Catch-all 테스트",
            cases=[
                ConditionCase(
                    id="case-specific",
                    case_name="Specific",
                    conditions=[
                        Condition(
                            id="c1",
                            variable_selector=["node-1", "type"],
                            operator=ConditionOperator.EQUALS,
                            value="special",
                        )
                    ],
                ),
                ConditionCase(
                    id="case-default",
                    case_name="Default",
                    conditions=[],  # 조건 없음 -> 항상 참
                ),
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        # "special"이 아닌 경우 -> case-default (catch-all)
        result = node.execute({"node-1": {"type": "normal"}})
        assert result["selected_handle"] == "case-default"


class TestConditionNodeOperators:
    """연산자별 조건 평가 테스트"""

    def test_equals_operator_true(self):
        """equals 연산자가 참으로 평가되는 경우"""
        node_data = ConditionNodeData(
            title="equals 테스트",
            cases=[
                ConditionCase(
                    id="case-true",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "status"],
                            operator=ConditionOperator.EQUALS,
                            value="success",
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"status": "success"}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "case-true"

    def test_equals_operator_false(self):
        """equals 연산자가 거짓으로 평가되는 경우"""
        node_data = ConditionNodeData(
            title="equals 테스트",
            cases=[
                ConditionCase(
                    id="case-true",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "status"],
                            operator=ConditionOperator.EQUALS,
                            value="success",
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"status": "failure"}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "default"

    def test_contains_operator(self):
        """contains 연산자 테스트"""
        node_data = ConditionNodeData(
            title="contains 테스트",
            cases=[
                ConditionCase(
                    id="case-match",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "message"],
                            operator=ConditionOperator.CONTAINS,
                            value="hello",
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"message": "say hello world"}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "case-match"

    def test_is_empty_operator(self):
        """is_empty 연산자 테스트"""
        node_data = ConditionNodeData(
            title="is_empty 테스트",
            cases=[
                ConditionCase(
                    id="case-empty",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "data"],
                            operator=ConditionOperator.IS_EMPTY,
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        # 빈 값 테스트
        assert node.execute({"node-1": {"data": ""}})["selected_handle"] == "case-empty"
        assert node.execute({"node-1": {"data": None}})["selected_handle"] == "case-empty"
        assert node.execute({"node-1": {"data": []}})["selected_handle"] == "case-empty"

        # 비어있지 않은 값 테스트
        assert node.execute({"node-1": {"data": "value"}})["selected_handle"] == "default"

    def test_greater_than_operator(self):
        """greater_than 연산자 테스트"""
        node_data = ConditionNodeData(
            title="greater_than 테스트",
            cases=[
                ConditionCase(
                    id="case-high",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "score"],
                            operator=ConditionOperator.GREATER_THAN,
                            value=50,
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        assert node.execute({"node-1": {"score": 70}})["selected_handle"] == "case-high"
        assert node.execute({"node-1": {"score": 30}})["selected_handle"] == "default"
        assert node.execute({"node-1": {"score": 50}})["selected_handle"] == "default"


class TestConditionNodeLogicalOperators:
    """논리 연산자 결합 테스트"""

    def test_and_operator_all_true(self):
        """AND 연산자 - 모두 참인 경우"""
        node_data = ConditionNodeData(
            title="AND 테스트",
            cases=[
                ConditionCase(
                    id="case-all-match",
                    logical_operator="and",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "a"],
                            operator=ConditionOperator.EQUALS,
                            value=1,
                        ),
                        Condition(
                            id="cond-2",
                            variable_selector=["node-1", "b"],
                            operator=ConditionOperator.EQUALS,
                            value=2,
                        ),
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "case-all-match"

    def test_and_operator_one_false(self):
        """AND 연산자 - 하나가 거짓인 경우"""
        node_data = ConditionNodeData(
            title="AND 테스트",
            cases=[
                ConditionCase(
                    id="case-all-match",
                    logical_operator="and",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "a"],
                            operator=ConditionOperator.EQUALS,
                            value=1,
                        ),
                        Condition(
                            id="cond-2",
                            variable_selector=["node-1", "b"],
                            operator=ConditionOperator.EQUALS,
                            value=999,
                        ),
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "default"

    def test_or_operator_one_true(self):
        """OR 연산자 - 하나가 참인 경우"""
        node_data = ConditionNodeData(
            title="OR 테스트",
            cases=[
                ConditionCase(
                    id="case-any-match",
                    logical_operator="or",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "a"],
                            operator=ConditionOperator.EQUALS,
                            value=999,  # 거짓
                        ),
                        Condition(
                            id="cond-2",
                            variable_selector=["node-1", "b"],
                            operator=ConditionOperator.EQUALS,
                            value=2,  # 참
                        ),
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "case-any-match"


class TestConditionNodeNestedSelector:
    """중첩된 variable_selector 테스트"""

    def test_nested_selector(self):
        """중첩된 경로에서 값 추출 테스트"""
        node_data = ConditionNodeData(
            title="중첩 selector 테스트",
            cases=[
                ConditionCase(
                    id="case-nested",
                    conditions=[
                        Condition(
                            id="cond-1",
                            variable_selector=["node-1", "response", "data", "status"],
                            operator=ConditionOperator.EQUALS,
                            value="ok",
                        )
                    ],
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"response": {"data": {"status": "ok"}}}}
        result = node.execute(inputs)

        assert result["selected_handle"] == "case-nested"
