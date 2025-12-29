"""WorkflowEngine 분기 처리 테스트"""

import pytest

from workflow.core.workflow_engine import WorkflowEngine


class TestWorkflowEngineBranching:
    """분기 노드가 포함된 워크플로우 실행 테스트"""

    def test_branch_true_path(self):
        """조건이 참일 때 true 분기만 실행되는지 테스트"""
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "시작"},
                },
                {
                    "id": "condition-1",
                    "type": "conditionNode",
                    "position": {"x": 100, "y": 0},
                    "data": {
                        "title": "조건 분기",
                        "conditions": [
                            {
                                "id": "cond-1",
                                "variable_selector": ["start-1", "value"],
                                "operator": "equals",
                                "value": "yes",
                            }
                        ],
                        "logical_operator": "and",
                    },
                },
                {
                    "id": "answer-true",
                    "type": "answerNode",
                    "position": {"x": 200, "y": -50},
                    "data": {
                        "title": "True 분기",
                        "outputs": [
                            {
                                "variable": "result",
                                "value_selector": ["condition-1", "result"],
                            }
                        ],
                    },
                },
                {
                    "id": "answer-false",
                    "type": "answerNode",
                    "position": {"x": 200, "y": 50},
                    "data": {
                        "title": "False 분기",
                        "outputs": [
                            {
                                "variable": "result",
                                "value_selector": ["condition-1", "result"],
                            }
                        ],
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source": "start-1", "target": "condition-1"},
                {
                    "id": "e2",
                    "source": "condition-1",
                    "target": "answer-true",
                    "sourceHandle": "true",
                },
                {
                    "id": "e3",
                    "source": "condition-1",
                    "target": "answer-false",
                    "sourceHandle": "false",
                },
            ],
        }

        # 조건이 참이 되는 입력
        engine = WorkflowEngine(graph, user_input={"value": "yes"})
        result = engine.execute()

        # true 분기의 결과가 반환되어야 함
        assert result["result"] is True

    def test_branch_false_path(self):
        """조건이 거짓일 때 false 분기만 실행되는지 테스트"""
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "시작"},
                },
                {
                    "id": "condition-1",
                    "type": "conditionNode",
                    "position": {"x": 100, "y": 0},
                    "data": {
                        "title": "조건 분기",
                        "conditions": [
                            {
                                "id": "cond-1",
                                "variable_selector": ["start-1", "value"],
                                "operator": "equals",
                                "value": "yes",
                            }
                        ],
                        "logical_operator": "and",
                    },
                },
                {
                    "id": "answer-true",
                    "type": "answerNode",
                    "position": {"x": 200, "y": -50},
                    "data": {
                        "title": "True 분기",
                        "outputs": [
                            {
                                "variable": "result",
                                "value_selector": ["condition-1", "result"],
                            }
                        ],
                    },
                },
                {
                    "id": "answer-false",
                    "type": "answerNode",
                    "position": {"x": 200, "y": 50},
                    "data": {
                        "title": "False 분기",
                        "outputs": [
                            {
                                "variable": "result",
                                "value_selector": ["condition-1", "result"],
                            }
                        ],
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source": "start-1", "target": "condition-1"},
                {
                    "id": "e2",
                    "source": "condition-1",
                    "target": "answer-true",
                    "sourceHandle": "true",
                },
                {
                    "id": "e3",
                    "source": "condition-1",
                    "target": "answer-false",
                    "sourceHandle": "false",
                },
            ],
        }

        # 조건이 거짓이 되는 입력
        engine = WorkflowEngine(graph, user_input={"value": "no"})
        result = engine.execute()

        # false 분기의 결과가 반환되어야 함
        assert result["result"] is False
