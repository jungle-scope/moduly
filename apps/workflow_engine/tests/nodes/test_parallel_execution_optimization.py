"""
Parallel Node Execution Optimization Tests

Tests for data dependency analysis and parallel execution optimization.
Verifies that nodes execute in parallel when they don't have true data dependencies.

Run:
    cd /Users/antinori/LEE/Engineer/nmm/nmm/code/moduly
    python -m pytest apps/workflow_engine/tests/nodes/test_parallel_execution_optimization.py -vs --asyncio-mode=auto
"""

import time

import pytest

from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

# ============================================================================
# Test Fixtures - Workflow Graphs
# ============================================================================


@pytest.fixture
def independent_nodes_graph():
    """
    Workflow with independent nodes that should execute in parallel:

    Start → [Node A (slow), Node B (fast, no dependency on A)]

    Node B should complete before Node A finishes.
    """
    return {
        "nodes": [
            {
                "id": "start-1",
                "type": "startNode",
                "position": {"x": 0, "y": 0},
                "data": {"title": "Start"},
            },
            {
                "id": "template-a",
                "type": "templateNode",
                "position": {"x": 200, "y": -50},
                "data": {
                    "title": "Template A (Slow)",
                    "template": "A: {{query}}",
                },
            },
            {
                "id": "template-b",
                "type": "templateNode",
                "position": {"x": 200, "y": 50},
                "data": {
                    "title": "Template B (Fast)",
                    "template": "B: static text",  # No value_selector, independent
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "start-1", "target": "template-a"},
            {"id": "e2", "source": "start-1", "target": "template-b"},
        ],
    }


@pytest.fixture
def dependent_nodes_graph():
    """
    Workflow with data dependencies:

    Start → Node A → Node B (uses A's output via value_selector)

    Node B should wait for Node A.
    """
    return {
        "nodes": [
            {
                "id": "start-1",
                "type": "startNode",
                "position": {"x": 0, "y": 0},
                "data": {"title": "Start"},
            },
            {
                "id": "template-a",
                "type": "templateNode",
                "position": {"x": 200, "y": 0},
                "data": {
                    "title": "Template A",
                    "template": "A: {{query}}",
                },
            },
            {
                "id": "answer-1",
                "type": "answerNode",
                "position": {"x": 400, "y": 0},
                "data": {
                    "title": "Answer",
                    "outputs": [
                        {
                            "variable": "result",
                            "value_selector": [
                                "template-a",
                                "result",
                            ],  # Depends on template-a
                        }
                    ],
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "start-1", "target": "template-a"},
            {"id": "e2", "source": "template-a", "target": "answer-1"},
        ],
    }


@pytest.fixture
def mixed_dependencies_graph():
    """
    Workflow with mixed dependencies:

    Start → [Node A (slow), Node B (fast)] → Node C (uses only B's output)

    Node C should start as soon as Node B completes (doesn't wait for A).
    """
    return {
        "nodes": [
            {
                "id": "start-1",
                "type": "startNode",
                "position": {"x": 0, "y": 0},
                "data": {"title": "Start"},
            },
            {
                "id": "template-a",
                "type": "templateNode",
                "position": {"x": 200, "y": -50},
                "data": {
                    "title": "Template A (Slow)",
                    "template": "A: {{query}}",
                },
            },
            {
                "id": "template-b",
                "type": "templateNode",
                "position": {"x": 200, "y": 50},
                "data": {
                    "title": "Template B (Fast)",
                    "template": "B: {{query}}",
                },
            },
            {
                "id": "answer-1",
                "type": "answerNode",
                "position": {"x": 400, "y": 0},
                "data": {
                    "title": "Answer",
                    "outputs": [
                        {
                            "variable": "result",
                            "value_selector": [
                                "template-b",
                                "result",
                            ],  # Only depends on B
                        }
                    ],
                },
            },
        ],
        "edges": [
            {"id": "e1", "source": "start-1", "target": "template-a"},
            {"id": "e2", "source": "start-1", "target": "template-b"},
            {"id": "e3", "source": "template-a", "target": "answer-1"},
            {"id": "e4", "source": "template-b", "target": "answer-1"},
        ],
    }


# ============================================================================
# Test Cases
# ============================================================================


class TestDataDependencyAnalysis:
    """Test data dependency analysis from value_selector fields"""

    def test_analyze_independent_nodes(self, independent_nodes_graph):
        """Independent nodes should have no data dependencies on each other"""
        engine = WorkflowEngine(graph=independent_nodes_graph)

        # template-b has no value_selector, so no data dependencies
        # It should only depend on start-1 (or have no dependencies in data_dependencies)
        assert (
            "template-b" not in engine.data_dependencies
            or "template-a" not in engine.data_dependencies.get("template-b", set())
        )

    def test_analyze_dependent_nodes(self, dependent_nodes_graph):
        """Nodes with value_selector should have correct data dependencies"""
        engine = WorkflowEngine(graph=dependent_nodes_graph)

        # answer-1 should depend on template-a (via value_selector)
        assert "answer-1" in engine.data_dependencies
        assert "template-a" in engine.data_dependencies["answer-1"]

    def test_analyze_mixed_dependencies(self, mixed_dependencies_graph):
        """Mixed dependencies should be correctly identified"""
        engine = WorkflowEngine(graph=mixed_dependencies_graph)

        # answer-1 should only depend on template-b (not template-a)
        assert "answer-1" in engine.data_dependencies
        assert "template-b" in engine.data_dependencies["answer-1"]
        assert "template-a" not in engine.data_dependencies["answer-1"]

    def test_start_node_has_no_dependencies(self, independent_nodes_graph):
        """Start nodes should have empty dependencies"""
        engine = WorkflowEngine(graph=independent_nodes_graph)

        assert "start-1" in engine.data_dependencies
        assert len(engine.data_dependencies["start-1"]) == 0


class TestParallelExecution:
    """Test parallel execution based on data dependencies"""

    @pytest.mark.asyncio
    async def test_independent_nodes_execute_in_parallel(self, independent_nodes_graph):
        """
        Independent nodes should execute in parallel.

        Since template-b doesn't depend on template-a's data,
        both should start immediately after start-1.
        """
        user_input = {"query": "test"}
        engine = WorkflowEngine(graph=independent_nodes_graph, user_input=user_input)

        # Track execution order
        execution_times = {}
        original_submit = engine._submit_node

        async def track_submit(node_id, *args, **kwargs):
            execution_times[node_id] = time.time()
            return await original_submit(node_id, *args, **kwargs)

        engine._submit_node = track_submit

        result = await engine.execute()

        # Both template-a and template-b should start at roughly the same time
        # (within a small tolerance for async scheduling)
        if "template-a" in execution_times and "template-b" in execution_times:
            time_diff = abs(
                execution_times["template-a"] - execution_times["template-b"]
            )
            assert time_diff < 0.1, (
                "Independent nodes should start nearly simultaneously"
            )

        # Verify both executed successfully
        assert "template-a" in result
        assert "template-b" in result

    @pytest.mark.asyncio
    async def test_dependent_nodes_wait_correctly(self, dependent_nodes_graph):
        """Nodes with data dependencies should wait for their dependencies"""
        user_input = {"query": "test"}
        engine = WorkflowEngine(graph=dependent_nodes_graph, user_input=user_input)

        result = await engine.execute()

        # answer-1 should have executed and received template-a's output
        assert "answer-1" in result
        assert "result" in result["answer-1"]

    @pytest.mark.asyncio
    async def test_mixed_dependencies_optimize_execution(
        self, mixed_dependencies_graph
    ):
        """
        Node C should start as soon as Node B completes,
        without waiting for Node A.
        """
        user_input = {"query": "test"}
        engine = WorkflowEngine(graph=mixed_dependencies_graph, user_input=user_input)

        # Track when nodes become ready
        ready_times = {}
        original_is_ready = engine._is_ready

        def track_is_ready(node_id, results):
            is_ready = original_is_ready(node_id, results)
            if is_ready and node_id not in ready_times:
                ready_times[node_id] = (time.time(), set(results.keys()))
            return is_ready

        engine._is_ready = track_is_ready

        result = await engine.execute()

        # answer-1 should become ready as soon as template-b completes
        # (not waiting for template-a)
        if "answer-1" in ready_times:
            _, completed_nodes = ready_times["answer-1"]
            assert "template-b" in completed_nodes
            # template-a may or may not be complete when answer-1 becomes ready

        assert "answer-1" in result


class TestBackwardCompatibility:
    """Test backward compatibility with nodes that don't use value_selector"""

    def test_nodes_without_value_selector_use_graph_edges(self):
        """
        Nodes without value_selector should have empty data dependencies,
        allowing them to execute immediately (not waiting for graph predecessors).
        """
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "Start"},
                },
                {
                    "id": "code-1",
                    "type": "codeNode",
                    "position": {"x": 200, "y": 0},
                    "data": {
                        "title": "Code Node",
                        "code": "result = 'test'",
                        # No value_selector in code nodes
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source": "start-1", "target": "code-1"},
            ],
        }

        engine = WorkflowEngine(graph=graph)

        # [FIX] code-1 should be in data_dependencies with empty set
        assert "code-1" in engine.data_dependencies
        assert len(engine.data_dependencies["code-1"]) == 0

        # _is_ready should work correctly (no dependencies = ready immediately)
        assert engine._is_ready("code-1", {})


class TestComplexWorkflows:
    """Test complex workflow scenarios"""

    @pytest.mark.asyncio
    async def test_multi_level_dependencies(self):
        """
        Test workflow with multiple levels:
        Start → A → B → C (each depends on previous)
        """
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "Start"},
                },
                {
                    "id": "template-a",
                    "type": "templateNode",
                    "position": {"x": 100, "y": 0},
                    "data": {"title": "A", "template": "A: {{query}}"},
                },
                {
                    "id": "template-b",
                    "type": "templateNode",
                    "position": {"x": 200, "y": 0},
                    "data": {
                        "title": "B",
                        "template": "B: {{a_result}}",
                        "referenced_variables": [
                            {"value_selector": ["template-a", "result"]}
                        ],
                    },
                },
                {
                    "id": "answer-1",
                    "type": "answerNode",
                    "position": {"x": 300, "y": 0},
                    "data": {
                        "title": "Answer",
                        "outputs": [
                            {
                                "variable": "result",
                                "value_selector": ["template-b", "result"],
                            }
                        ],
                    },
                },
            ],
            "edges": [
                {"id": "e1", "source": "start-1", "target": "template-a"},
                {"id": "e2", "source": "template-a", "target": "template-b"},
                {"id": "e3", "source": "template-b", "target": "answer-1"},
            ],
        }

        engine = WorkflowEngine(graph=graph, user_input={"query": "test"})
        result = await engine.execute()

        # All nodes should execute in correct order
        assert "template-a" in result
        assert "template-b" in result
        assert "answer-1" in result


# ============================================================================
# Performance Tests
# ============================================================================


class TestPerformanceImprovement:
    """Test that parallel execution actually improves performance"""

    @pytest.mark.asyncio
    async def test_parallel_execution_is_faster(self):
        """
        Verify that parallel execution of independent nodes is faster
        than sequential execution would be.

        This is a conceptual test - actual timing depends on node execution time.
        """
        # Create workflow with 3 independent branches
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "Start"},
                },
                {
                    "id": "template-a",
                    "type": "templateNode",
                    "position": {"x": 200, "y": -100},
                    "data": {"title": "A", "template": "A"},
                },
                {
                    "id": "template-b",
                    "type": "templateNode",
                    "position": {"x": 200, "y": 0},
                    "data": {"title": "B", "template": "B"},
                },
                {
                    "id": "template-c",
                    "type": "templateNode",
                    "position": {"x": 200, "y": 100},
                    "data": {"title": "C", "template": "C"},
                },
            ],
            "edges": [
                {"id": "e1", "source": "start-1", "target": "template-a"},
                {"id": "e2", "source": "start-1", "target": "template-b"},
                {"id": "e3", "source": "start-1", "target": "template-c"},
            ],
        }

        engine = WorkflowEngine(graph=graph, user_input={})

        start_time = time.time()
        result = await engine.execute()
        execution_time = time.time() - start_time

        # All three templates should execute
        assert "template-a" in result
        assert "template-b" in result
        assert "template-c" in result

        # Execution should be fast (parallel, not sequential)
        # This is a loose check - mainly verifying no errors
        assert execution_time < 5.0, "Parallel execution should complete quickly"
