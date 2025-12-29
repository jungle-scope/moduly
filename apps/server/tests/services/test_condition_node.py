"""ConditionNode 테스트"""

import pytest

from workflow.nodes.base.entities import NodeStatus
from workflow.nodes.condition import ConditionNode, ConditionNodeData
from workflow.nodes.condition.entities import Condition, ConditionOperator


class TestConditionNodeInitialization:
    """ConditionNode 초기화 테스트"""

    def test_basic_initialization(self):
        """기본 초기화가 올바르게 동작하는지 테스트"""
        node_data = ConditionNodeData(
            title="테스트 조건 노드",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "value"],
                    operator=ConditionOperator.EQUALS,
                    value="test",
                )
            ],
        )

        node = ConditionNode(id="cond-node-1", data=node_data)

        assert node.id == "cond-node-1"
        assert node.data.title == "테스트 조건 노드"
        assert len(node.data.conditions) == 1
        assert node.data.logical_operator == "and"
        assert node.status == NodeStatus.IDLE
        assert node.node_type == "conditionNode"


class TestConditionNodeOperators:
    """연산자별 조건 평가 테스트"""

    def test_equals_operator_true(self):
        """equals 연산자가 참으로 평가되는 경우"""
        node_data = ConditionNodeData(
            title="equals 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "status"],
                    operator=ConditionOperator.EQUALS,
                    value="success",
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"status": "success"}}
        result = node.execute(inputs)

        assert result["result"] is True
        assert result["selected_handle"] == "true"

    def test_equals_operator_false(self):
        """equals 연산자가 거짓으로 평가되는 경우"""
        node_data = ConditionNodeData(
            title="equals 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "status"],
                    operator=ConditionOperator.EQUALS,
                    value="success",
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"status": "failure"}}
        result = node.execute(inputs)

        assert result["result"] is False
        assert result["selected_handle"] == "false"

    def test_contains_operator(self):
        """contains 연산자 테스트"""
        node_data = ConditionNodeData(
            title="contains 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "message"],
                    operator=ConditionOperator.CONTAINS,
                    value="hello",
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"message": "say hello world"}}
        result = node.execute(inputs)

        assert result["result"] is True
        assert result["selected_handle"] == "true"

    def test_is_empty_operator(self):
        """is_empty 연산자 테스트"""
        node_data = ConditionNodeData(
            title="is_empty 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "data"],
                    operator=ConditionOperator.IS_EMPTY,
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        # 빈 값 테스트
        assert node.execute({"node-1": {"data": ""}})["result"] is True
        assert node.execute({"node-1": {"data": None}})["result"] is True
        assert node.execute({"node-1": {"data": []}})["result"] is True

        # 비어있지 않은 값 테스트
        assert node.execute({"node-1": {"data": "value"}})["result"] is False

    def test_greater_than_operator(self):
        """greater_than 연산자 테스트"""
        node_data = ConditionNodeData(
            title="greater_than 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "score"],
                    operator=ConditionOperator.GREATER_THAN,
                    value=50,
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        assert node.execute({"node-1": {"score": 70}})["result"] is True
        assert node.execute({"node-1": {"score": 30}})["result"] is False
        assert node.execute({"node-1": {"score": 50}})["result"] is False


class TestConditionNodeLogicalOperators:
    """논리 연산자 결합 테스트"""

    def test_and_operator_all_true(self):
        """AND 연산자 - 모두 참인 경우"""
        node_data = ConditionNodeData(
            title="AND 테스트",
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
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["result"] is True

    def test_and_operator_one_false(self):
        """AND 연산자 - 하나가 거짓인 경우"""
        node_data = ConditionNodeData(
            title="AND 테스트",
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
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["result"] is False

    def test_or_operator_one_true(self):
        """OR 연산자 - 하나가 참인 경우"""
        node_data = ConditionNodeData(
            title="OR 테스트",
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
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"a": 1, "b": 2}}
        result = node.execute(inputs)

        assert result["result"] is True


class TestConditionNodeNestedSelector:
    """중첩된 variable_selector 테스트"""

    def test_nested_selector(self):
        """중첩된 경로에서 값 추출 테스트"""
        node_data = ConditionNodeData(
            title="중첩 selector 테스트",
            conditions=[
                Condition(
                    id="cond-1",
                    variable_selector=["node-1", "response", "data", "status"],
                    operator=ConditionOperator.EQUALS,
                    value="ok",
                )
            ],
        )
        node = ConditionNode(id="test", data=node_data)

        inputs = {"node-1": {"response": {"data": {"status": "ok"}}}}
        result = node.execute(inputs)

        assert result["result"] is True
