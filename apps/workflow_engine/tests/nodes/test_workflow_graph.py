"""
WorkflowGraph 단위 테스트

노드 실행 없이 그래프 구조 분석/검증만 확인합니다.

실행 방법:
    apps/workflow_engine/.venv/bin/python -m pytest \
        apps/workflow_engine/tests/nodes/test_workflow_graph.py -v
"""

import pytest

from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.workflow_graph import WorkflowGraph


def node(node_id, node_type, **data):
    return NodeSchema(id=node_id, type=node_type, position={"x": 0, "y": 0}, data=data)


def edge(source, target, handle=None):
    return EdgeSchema(
        id=f"{source}->{target}", source=source, target=target, sourceHandle=handle
    )


@pytest.fixture
def branching():
    """start → cond → (yes) a / (no) b"""
    return WorkflowGraph(
        nodes=[
            node("start", "startNode"),
            node("cond", "conditionNode"),
            node("a", "answerNode", outputs=[{"value_selector": ["cond", "x"]}]),
            node("b", "answerNode"),
        ],
        edges=[
            edge("start", "cond"),
            edge("cond", "a", handle="yes"),
            edge("cond", "b", handle="no"),
        ],
    )


class TestIndexes:
    def test_edge_indexes(self, branching):
        assert branching.adjacency_list == {"start": ["cond"], "cond": ["a", "b"]}
        assert branching.reverse_graph == {
            "cond": ["start"],
            "a": ["cond"],
            "b": ["cond"],
        }
        assert branching.edge_handles[("cond", "yes")] == ["a"]

    def test_nodes_by_type(self, branching):
        assert branching.nodes_by_type["answerNode"] == ["a", "b"]

    def test_data_dependencies_come_from_value_selectors(self, branching):
        assert branching.data_dependencies == {
            "start": set(),
            "cond": set(),
            "a": {"cond"},
            "b": set(),
        }

    def test_value_selector_to_unknown_node_is_ignored(self):
        graph = WorkflowGraph(
            nodes=[
                node("start", "startNode"),
                node("a", "answerNode", nested=[{"value_selector": ["ghost", "x"]}]),
            ],
            edges=[edge("start", "a")],
        )

        assert graph.data_dependencies["a"] == set()

    def test_trigger_node_selectors_are_ignored(self):
        graph = WorkflowGraph(
            nodes=[
                node("start", "startNode", ref={"value_selector": ["a", "x"]}),
                node("a", "answerNode"),
            ],
            edges=[edge("start", "a")],
        )

        assert graph.data_dependencies["start"] == set()


class TestTraversal:
    def test_next_nodes_without_handle_follows_all_edges(self, branching):
        assert branching.get_next_nodes("cond", {}) == ["a", "b"]

    def test_next_nodes_with_handle(self, branching):
        assert branching.get_next_nodes("cond", {"selected_handle": "no"}) == ["b"]
        assert branching.get_next_nodes("cond", {"selected_handle": "??"}) == []

    def test_next_nodes_of_leaf(self, branching):
        assert branching.get_next_nodes("a", {}) == []

    def test_is_ready(self, branching):
        assert not branching.is_ready("a", {"start": {}})
        assert branching.is_ready("a", {"cond": {}})
        assert branching.is_ready("b", {})

    def test_is_trigger(self, branching):
        assert branching.is_trigger("start")
        assert not branching.is_trigger("cond")
        assert not branching.is_trigger("ghost")


class TestValidation:
    def test_valid_graph_sets_start_node(self, branching):
        branching.validate()

        assert branching.find_start_node() == "start"

    def test_find_start_node_before_validate(self, branching):
        with pytest.raises(ValueError, match="먼저 호출"):
            branching.find_start_node()

    def test_cycle(self):
        graph = WorkflowGraph(
            nodes=[node("start", "startNode"), node("a", "x"), node("b", "x")],
            edges=[edge("start", "a"), edge("a", "b"), edge("b", "a")],
        )

        with pytest.raises(ValueError, match="순환"):
            graph.validate()

    def test_no_start_node(self):
        with pytest.raises(ValueError, match="없습니다"):
            WorkflowGraph(nodes=[node("a", "answerNode")], edges=[]).validate()

    def test_multiple_start_nodes(self):
        graph = WorkflowGraph(
            nodes=[node("s1", "startNode"), node("s2", "scheduleTrigger")], edges=[]
        )

        with pytest.raises(ValueError, match="2개"):
            graph.validate()

    def test_isolated_node(self):
        graph = WorkflowGraph(
            nodes=[node("start", "startNode"), node("orphan", "answerNode")], edges=[]
        )

        with pytest.raises(ValueError, match="orphan"):
            graph.validate()

    def test_note_is_not_isolated(self):
        graph = WorkflowGraph(
            nodes=[node("start", "startNode"), node("memo", "note")], edges=[]
        )

        graph.validate()
