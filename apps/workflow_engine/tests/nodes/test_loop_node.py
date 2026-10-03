"""
LoopNode 통합 테스트 (WorkflowEngine + 실제 LoopNode)

루프 서브그래프는 부모 실행(run)의 일부입니다.
- 내부 노드의 로그/이벤트는 부모 run에 붙어서 나간다
- run 자체의 생성/종료 로그와 workflow_finish/error 이벤트는 부모 엔진만 낸다

실행 방법:
    apps/workflow_engine/.venv/bin/python -m pytest \
        apps/workflow_engine/tests/nodes/test_loop_node.py -v
"""

import json
import uuid
from unittest.mock import MagicMock, patch

import pytest

from apps.shared.celery_app import celery_app
from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory


class FailingNode:
    """data.fail_on_calls 에 지정한 호출 순번(1부터)에서만 실패하는 노드"""

    def __init__(self, schema):
        self.id = schema.id
        self.data = schema.data

    def execute(self, inputs):
        # 루프는 엔진과 노드 인스턴스를 재사용하므로 호출 횟수 = 반복 순번
        self.data["_calls"] = self.data.get("_calls", 0) + 1
        if self.data["_calls"] in self.data["fail_on_calls"]:
            raise RuntimeError("inner boom")
        return {"ok": True}


class Recorder:
    def __init__(self):
        self.send_task = MagicMock()
        self.redis = MagicMock()

    @property
    def log_tasks(self):
        return [(c.args[0], c.kwargs["args"][0]) for c in self.send_task.call_args_list]

    @property
    def log_task_names(self):
        return [name for name, _ in self.log_tasks]

    @property
    def published(self):
        """[(channel, event_type, data)]"""
        result = []
        for c in self.redis.publish.call_args_list:
            channel, message = c.args
            payload = json.loads(message)
            result.append((channel, payload["type"], payload["data"]))
        return result

    @property
    def published_types(self):
        return [event_type for _, event_type, _ in self.published]


@pytest.fixture
def recorder():
    r = Recorder()
    real_create = NodeFactory.create

    def create(schema, context=None):
        if schema.type == "failingNode":
            return FailingNode(schema)
        return real_create(schema, context=context)

    with (
        patch.object(NodeFactory, "create", side_effect=create),
        patch.object(celery_app, "send_task", r.send_task),
        patch("apps.shared.pubsub.get_redis_client", return_value=r.redis),
    ):
        yield r


def node(node_id, node_type, **data):
    return {
        "id": node_id,
        "type": node_type,
        "position": {"x": 0, "y": 0},
        "data": {"title": node_id, **data},
    }


def edge(source, target):
    return {"id": f"{source}->{target}", "source": source, "target": target}


def loop_graph(inner_node, **loop_data):
    """start → loop(sub-start → inner) → answer"""
    sub_graph = {
        "nodes": [node("sub-start", "startNode"), inner_node],
        "edges": [edge("sub-start", inner_node["id"])],
    }
    items_var = {"id": "v", "name": "items", "label": "items", "type": "text"}
    return {
        "nodes": [
            node("start", "startNode", variables=[items_var]),
            node(
                "loop",
                "loopNode",
                loop_key="start.items",
                subGraph=sub_graph,
                **loop_data,
            ),
            node("answer", "answerNode", outputs=[]),
        ],
        "edges": [edge("start", "loop"), edge("loop", "answer")],
    }


def template_node():
    return node("sub-tpl", "templateNode", template="x", variables=[])


def run_engine(graph, items, run_id=None):
    context = {"workflow_id": "wf-1", "user_id": "user-1"}
    if run_id:
        context["workflow_run_id"] = run_id
    engine = WorkflowEngine(
        graph=graph, user_input={"items": items}, execution_context=context
    )
    return engine, engine.execute()


class TestLoopRunReporting:
    def test_loop_iterates_and_collects_results(self, recorder):
        _, result = run_engine(loop_graph(template_node()), items=[1, 2, 3])

        assert len(result["loop"]["results"]) == 3
        assert "answer" in result

    def test_workflow_finish_published_once_at_the_end(self, recorder):
        """루프 반복이 부모 채널에 workflow_finish를 내면 SSE가 조기 종료된다"""
        run_id = str(uuid.uuid4())

        run_engine(loop_graph(template_node()), items=[1, 2], run_id=run_id)

        assert recorder.published_types.count("workflow_finish") == 1
        assert recorder.published_types[-1] == "workflow_finish"
        assert {channel for channel, _, _ in recorder.published} == {
            f"workflow:{run_id}"
        }

    def test_run_log_created_and_finished_once(self, recorder):
        run_engine(loop_graph(template_node()), items=[1, 2])

        assert recorder.log_task_names.count("log.create_run") == 1
        assert recorder.log_task_names.count("log.update_run_finish") == 1
        assert recorder.log_task_names[0] == "log.create_run"
        assert recorder.log_task_names[-1] == "log.update_run_finish"

    def test_inner_nodes_report_to_parent_run(self, recorder):
        """루프 내부 노드의 이벤트/로그는 반복마다 부모 run으로 나간다"""
        run_id = str(uuid.uuid4())

        run_engine(loop_graph(template_node()), items=[1, 2], run_id=run_id)

        inner_finishes = [
            data
            for _, event_type, data in recorder.published
            if event_type == "node_finish" and data["node_id"] == "sub-tpl"
        ]
        assert len(inner_finishes) == 2

        inner_logs = [
            payload
            for name, payload in recorder.log_tasks
            if name == "log.create_node" and payload["node_id"] == "sub-tpl"
        ]
        assert len(inner_logs) == 2
        assert {payload["workflow_run_id"] for payload in inner_logs} == {run_id}

    def test_generated_run_id_is_shared_with_loop(self, recorder):
        """외부 run_id 없이 엔진이 만든 run_id도 루프 내부 노드에 그대로 쓰인다"""
        engine, _ = run_engine(loop_graph(template_node()), items=[1])

        run_id = engine.execution_context["workflow_run_id"]
        node_logs = [p for name, p in recorder.log_tasks if name == "log.create_node"]
        assert {p["workflow_run_id"] for p in node_logs} == {run_id}
        assert recorder.log_task_names.count("log.create_run") == 1


class TestLoopNesting:
    def test_loop_inside_subworkflow_is_silent(self, recorder):
        """서브 워크플로우(WorkflowNode가 만드는 엔진) 안의 루프는 내부 노드도 보고하지 않는다"""
        engine = WorkflowEngine(
            graph=loop_graph(template_node()),
            user_input={"items": [1, 2]},
            execution_context={"workflow_id": "wf-1", "user_id": "user-1"},
            is_deployed=True,
            parent_run_id=str(uuid.uuid4()),
            is_subworkflow=True,
        )

        engine.execute()

        assert recorder.log_task_names == []
        assert recorder.published == []

    def test_subworkflow_flag_does_not_leak_into_caller_context(self, recorder):
        """서브 워크플로우 표시는 엔진이 복사한 컨텍스트에만 남는다"""
        caller_context = {"workflow_id": "wf-1", "user_id": "user-1"}

        WorkflowEngine(
            graph=loop_graph(template_node()),
            execution_context=caller_context,
            parent_run_id=str(uuid.uuid4()),
            is_subworkflow=True,
        )

        assert caller_context == {"workflow_id": "wf-1", "user_id": "user-1"}

    def test_nested_loops_report_run_once(self, recorder):
        """루프 안의 루프도 부모 run에 붙어 run 종료는 1번만 보고된다"""
        loop_var = {"id": "l", "name": "loop", "label": "loop", "type": "text"}
        inner_sub = {
            "nodes": [node("inner-start", "startNode"), template_node()],
            "edges": [edge("inner-start", "sub-tpl")],
        }
        outer_sub_nodes = [
            node("sub-start", "startNode", variables=[loop_var]),
            node(
                "inner-loop",
                "loopNode",
                loop_key="sub-start.loop.item",
                subGraph=inner_sub,
            ),
        ]
        graph = loop_graph(outer_sub_nodes[1])
        graph["nodes"][1]["data"]["subGraph"]["nodes"][0] = outer_sub_nodes[0]
        run_id = str(uuid.uuid4())

        _, result = run_engine(graph, items=[[1, 2], [3]], run_id=run_id)

        inner_results = [
            len(iteration["inner-loop"]["results"])
            for iteration in result["loop"]["results"]
        ]
        assert inner_results == [2, 1]
        assert recorder.published_types.count("workflow_finish") == 1
        assert recorder.log_task_names.count("log.create_run") == 1
        assert recorder.log_task_names.count("log.update_run_finish") == 1
        inner_logs = [
            p
            for name, p in recorder.log_tasks
            if name == "log.create_node" and p["node_id"] == "sub-tpl"
        ]
        assert len(inner_logs) == 3
        assert {p["workflow_run_id"] for p in inner_logs} == {run_id}


class TestLoopFailures:
    def failing_graph(self, fail_on_calls, **loop_data):
        inner = node("sub-fail", "failingNode", fail_on_calls=fail_on_calls)
        return loop_graph(inner, **loop_data)

    def test_continue_strategy_does_not_publish_error(self, recorder):
        """error_strategy=continue면 반복 실패는 결과에만 남고 실행은 정상 종료된다"""
        graph = self.failing_graph(fail_on_calls=[1], error_strategy="continue")

        _, result = run_engine(graph, items=[1, 2])

        assert "error" not in recorder.published_types
        assert recorder.published_types[-1] == "workflow_finish"
        assert "log.update_run_error" not in recorder.log_task_names
        assert result["loop"]["results"][0] == {"error": "inner boom"}
        assert "sub-fail" in result["loop"]["results"][1]

    def test_end_strategy_reports_failure_once(self, recorder):
        """error_strategy=end면 부모 엔진이 run 에러를 1번만 보고한다"""
        graph = self.failing_graph(fail_on_calls=[1], error_strategy="end")

        with pytest.raises(ValueError, match="inner boom"):
            run_engine(graph, items=[1, 2])

        assert recorder.published_types.count("error") == 1
        assert recorder.published_types[-1] == "error"
        assert "workflow_finish" not in recorder.published_types
        assert recorder.log_task_names.count("log.update_run_error") == 1
        assert "log.update_run_finish" not in recorder.log_task_names
        # 실패한 내부 노드의 에러 로그는 남는다
        node_errors = [
            p for name, p in recorder.log_tasks if name == "log.update_node_error"
        ]
        assert [p["node_id"] for p in node_errors] == ["sub-fail", "loop"]
