import asyncio
import time
import uuid
from typing import Any, Dict
from unittest.mock import MagicMock, patch

from workflow.core.workflow_engine import WorkflowEngine


# Mock Node that simulates blocking I/O
class MockNode:
    def __init__(self, node_id, data, execution_context=None):
        self.node_id = node_id
        self.data = data

    def execute(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        print(f"[{self.node_id}] Start executing... (Sleep 1s)")
        time.sleep(1.0)  # Blocking sleep
        print(f"[{self.node_id}] Finished execution")
        return {"result": f"processed_{self.node_id}"}


async def run_verification():
    # 1. Setup Graph
    # Start -> Node A
    # Start -> Node B
    # Both A and B run in parallel

    start_node_id = "start-node"
    node_a_id = "node-a"
    node_b_id = "node-b"

    nodes = [
        {
            "id": start_node_id,
            "type": "startNode",
            "data": {},
            "position": {"x": 0, "y": 0},
        },
        {
            "id": node_a_id,
            "type": "codeNode",
            "data": {},
            "position": {"x": 100, "y": 0},
        },  # Type doesn't matter as we mock factory
        {
            "id": node_b_id,
            "type": "codeNode",
            "data": {},
            "position": {"x": 100, "y": 100},
        },
    ]

    edges = [
        {
            "id": "e1",
            "source": start_node_id,
            "target": node_a_id,
            "sourceHandle": "source",
            "targetHandle": "target",
        },
        {
            "id": "e2",
            "source": start_node_id,
            "target": node_b_id,
            "sourceHandle": "source",
            "targetHandle": "target",
        },
    ]

    graph = {"nodes": nodes, "edges": edges}

    # 2. Mock NodeFactory and WorkflowLogger
    with (
        patch("workflow.core.workflow_engine.NodeFactory") as mock_factory,
        patch("workflow.core.workflow_engine.WorkflowLogger") as mock_logger_cls,
    ):

        def create_mock_node(schema, context):
            # StartNode는 즉시 실행, 나머지는 1초 지연
            if schema.type == "startNode":
                node = MockNode(schema.id, schema.data)
                node.execute = lambda inputs: {"result": "processed_start"}
                return node
            return MockNode(schema.id, schema.data)

        mock_factory.create.side_effect = create_mock_node

        # Mock Logger instance
        mock_logger = MagicMock()
        mock_logger.create_run_log.return_value = uuid.uuid4()
        mock_logger_cls.return_value = mock_logger

        # 3. Initialize Engine
        engine = WorkflowEngine(
            graph=graph,
            execution_context={
                "workflow_id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
            },
        )

        # 4. Run Execute
        print("Starting Workflow Execution...")
        start_time = time.time()

        result = await engine.execute()

        end_time = time.time()
        duration = end_time - start_time

        print(f"Workflow Finished in {duration:.2f} seconds")
        print("Result:", result)

        # 5. Verify Duration
        # If parallel, it should take ~1s. If serial, ~2s.
        if 1.0 <= duration < 1.5:
            print("SUCCESS: Parallel execution verified!")
        else:
            print(f"WARNING: Execution time expectation failed. Took {duration:.2f}s")


if __name__ == "__main__":
    asyncio.run(run_verification())
