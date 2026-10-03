"""
WorkflowEngine 특성화(characterization) 테스트 [GEVENT] Sync 버전

엔진의 "현재 동작"을 고정해 두는 테스트입니다. 리팩토링 중 회귀를 잡는 것이 목적이므로
엔진 내부 구현(private 메서드, 모듈 내 import 경로)에는 의존하지 않고 바깥 경계만 관찰합니다.

- 노드: NodeFactory.create 를 FakeNode 로 대체 (schema.data 로 동작 제어)
- 로그: celery_app.send_task 호출 (Log-System 으로 나가는 태스크)
- Pub/Sub: redis client.publish 호출

실행 방법:
    apps/workflow_engine/.venv/bin/python -m pytest \
        apps/workflow_engine/tests/nodes/test_workflow_engine.py -v
"""

import json
import uuid
from unittest.mock import MagicMock, patch

import gevent
import pytest

from apps.shared.celery_app import celery_app
from apps.shared.schemas.workflow import EdgeSchema, NodeSchema
from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine
from apps.workflow_engine.workflow.core.workflow_node_factory import NodeFactory

LOGGED_CONTEXT = {"workflow_id": "wf-1", "user_id": "user-1"}


# ============================================================================
# 테스트 하네스
# ============================================================================


class FakeNode:
    """
    schema.data 로 동작을 제어하는 가짜 노드

    - output: execute() 반환값
    - sleep: 반환 전 대기 시간(초)
    - raise: 지정 시 해당 메시지로 RuntimeError 발생
    """

    def __init__(self, schema, calls, finished):
        self.id = schema.id
        self.data = schema.data
        self._calls = calls
        self._finished = finished

    def execute(self, inputs):
        self._calls.append((self.id, dict(inputs)))
        if self.data.get("sleep"):
            gevent.sleep(self.data["sleep"])
        if self.data.get("raise"):
            raise RuntimeError(self.data["raise"])
        self._finished.append(self.id)
        return dict(self.data.get("output", {}))


class Harness:
    """엔진 바깥으로 나가는 호출(노드 실행 / 로그 태스크 / Pub/Sub)을 기록"""

    def __init__(self):
        self.calls = []  # [(node_id, inputs)]
        self.finished = []  # 예외/중단 없이 끝까지 실행된 node_id
        self.send_task = MagicMock()
        self.redis = MagicMock()

    @property
    def executed(self):
        return [node_id for node_id, _ in self.calls]

    def inputs_of(self, node_id):
        return next(inputs for nid, inputs in self.calls if nid == node_id)

    @property
    def log_tasks(self):
        """[(task_name, payload)]"""
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
def harness():
    h = Harness()

    def create(schema, context=None):
        return FakeNode(schema, h.calls, h.finished)

    with (
        patch.object(NodeFactory, "create", side_effect=create),
        patch.object(celery_app, "send_task", h.send_task),
        patch("apps.shared.pubsub.get_redis_client", return_value=h.redis),
    ):
        yield h


def node(node_id, node_type, timeout=None, **data):
    schema = {
        "id": node_id,
        "type": node_type,
        "position": {"x": 0, "y": 0},
        "data": {"title": node_id, **data},
    }
    if timeout is not None:
        schema["timeout"] = timeout
    return schema


def edge(source, target, handle=None):
    schema = {"id": f"{source}->{target}", "source": source, "target": target}
    if handle is not None:
        schema["sourceHandle"] = handle
    return schema


def linear_graph(**answer_data):
    """start-1 → answer-1"""
    answer_data.setdefault("output", {"result": "done"})
    return {
        "nodes": [
            node("start-1", "startNode", output={"query": "hi"}),
            node("answer-1", "answerNode", **answer_data),
        ],
        "edges": [edge("start-1", "answer-1")],
    }


def branching_graph(selected_handle):
    """start-1 → condition-1 → (case-true) answer-true / (default) answer-false"""
    return {
        "nodes": [
            node("start-1", "startNode"),
            node(
                "condition-1",
                "conditionNode",
                output={"selected_handle": selected_handle},
            ),
            node("answer-true", "answerNode", output={"result": "T"}),
            node("answer-false", "answerNode", output={"result": "F"}),
        ],
        "edges": [
            edge("start-1", "condition-1"),
            edge("condition-1", "answer-true", handle="case-true"),
            edge("condition-1", "answer-false", handle="default"),
        ],
    }


def event_summary(events):
    """[(type, node_id)] 형태로 요약"""
    return [(e["type"], e["data"].get("node_id")) for e in events]


# ============================================================================
# 1. 실행 모드별 결과
# ============================================================================


class TestExecutionModes:
    def test_execute_returns_all_node_results(self, harness):
        """개발 모드 execute()는 모든 노드의 결과를 반환한다"""
        engine = WorkflowEngine(graph=linear_graph(), user_input={"query": "hi"})

        result = engine.execute()

        assert result == {"start-1": {"query": "hi"}, "answer-1": {"result": "done"}}

    def test_deployed_execute_returns_answer_node_result_only(self, harness):
        """배포 모드 execute()는 answerNode 결과만 반환한다"""
        engine = WorkflowEngine(graph=linear_graph(), is_deployed=True)

        assert engine.execute() == {"result": "done"}

    def test_deployed_without_answer_node_returns_none(self, harness):
        """answerNode가 없는 워크플로우(webhook 등)는 배포 모드에서 None을 반환한다"""
        graph = {"nodes": [node("start-1", "startNode")], "edges": []}
        engine = WorkflowEngine(graph=graph, is_deployed=True)

        assert engine.execute() is None

    def test_tuple_graph_input(self, harness):
        """graph는 dict 대신 (nodes, edges) 스키마 튜플로도 받을 수 있다"""
        graph = linear_graph()
        nodes = [NodeSchema(**n) for n in graph["nodes"]]
        edges = [EdgeSchema(**e) for e in graph["edges"]]
        engine = WorkflowEngine(graph=(nodes, edges), is_deployed=True)

        assert engine.execute() == {"result": "done"}

    def test_stream_event_sequence(self, harness):
        """스트림 모드는 workflow_start → node_* → workflow_finish 순으로 이벤트를 낸다"""
        engine = WorkflowEngine(graph=linear_graph())

        events = list(engine.execute_stream())

        assert event_summary(events) == [
            ("workflow_start", None),
            ("node_start", "start-1"),
            ("node_finish", "start-1"),
            ("node_start", "answer-1"),
            ("node_finish", "answer-1"),
            ("workflow_finish", None),
        ]
        assert events[1]["data"] == {"node_id": "start-1", "node_type": "startNode"}
        assert events[4]["data"] == {
            "node_id": "answer-1",
            "node_type": "answerNode",
            "output": {"result": "done"},
        }
        assert events[-1]["data"] == {
            "start-1": {"query": "hi"},
            "answer-1": {"result": "done"},
        }


# ============================================================================
# 2. 노드 입력 구성 / 스케줄링
# ============================================================================


class TestSchedulingAndInputs:
    def test_trigger_node_receives_user_input(self, harness):
        """시작 노드는 user_input을, 그 외 노드는 누적 결과를 입력으로 받는다"""
        engine = WorkflowEngine(graph=linear_graph(), user_input={"query": "hi"})

        engine.execute()

        assert harness.inputs_of("start-1") == {"query": "hi"}
        assert harness.inputs_of("answer-1") == {"start-1": {"query": "hi"}}

    @pytest.mark.parametrize(
        "handle, taken, skipped",
        [
            ("case-true", "answer-true", "answer-false"),
            ("default", "answer-false", "answer-true"),
        ],
    )
    def test_selected_handle_chooses_branch(self, harness, handle, taken, skipped):
        """selected_handle에 해당하는 분기만 실행된다"""
        engine = WorkflowEngine(graph=branching_graph(handle))

        result = engine.execute()

        assert taken in result
        assert skipped not in result
        assert skipped not in harness.executed

    def test_unknown_selected_handle_runs_no_branch(self, harness):
        """매칭되는 엣지가 없는 handle이면 이후 노드는 실행되지 않고 정상 종료된다"""
        engine = WorkflowEngine(graph=branching_graph("no-such-handle"))

        result = engine.execute()

        assert set(result) == {"start-1", "condition-1"}

    def test_join_node_without_selector_runs_once_after_first_predecessor(
        self, harness
    ):
        """
        [현재 동작] value_selector가 없는 합류 노드는 모든 선행 노드를 기다리지 않고
        첫 선행 노드가 끝나는 즉시 1회만 실행된다 (data_dependencies가 빈 set)
        """
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("a", "templateNode", sleep=0.05, output={"text": "A"}),
                node("b", "templateNode", output={"text": "B"}),
                node("answer-1", "answerNode"),
            ],
            "edges": [
                edge("start-1", "a"),
                edge("start-1", "b"),
                edge("a", "answer-1"),
                edge("b", "answer-1"),
            ],
        }
        engine = WorkflowEngine(graph=graph)

        result = engine.execute()

        assert harness.executed.count("answer-1") == 1
        assert set(harness.inputs_of("answer-1")) == {"start-1", "b"}
        assert set(result) == {"start-1", "a", "b", "answer-1"}

    def test_join_node_waits_for_all_selected_nodes(self, harness):
        """value_selector로 참조한 노드가 모두 끝나야 합류 노드가 실행된다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("a", "templateNode", sleep=0.05, output={"text": "A"}),
                node("b", "templateNode", output={"text": "B"}),
                node(
                    "answer-1",
                    "answerNode",
                    outputs=[
                        {"variable": "a", "value_selector": ["a", "text"]},
                        {"variable": "b", "value_selector": ["b", "text"]},
                    ],
                ),
            ],
            "edges": [
                edge("start-1", "a"),
                edge("start-1", "b"),
                edge("a", "answer-1"),
                edge("b", "answer-1"),
            ],
        }
        engine = WorkflowEngine(graph=graph)

        engine.execute()

        assert harness.executed.count("answer-1") == 1
        assert set(harness.inputs_of("answer-1")) == {"start-1", "a", "b"}

    def test_value_selector_dependency_overrides_edges(self, harness):
        """value_selector가 있으면 엣지 대신 참조한 노드만 기다린다 (느린 형제를 기다리지 않음)"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("slow", "templateNode", sleep=0.2),
                node("fast", "templateNode", output={"text": "F"}),
                node(
                    "answer-1",
                    "answerNode",
                    outputs=[{"variable": "r", "value_selector": ["fast", "text"]}],
                ),
            ],
            "edges": [
                edge("start-1", "slow"),
                edge("start-1", "fast"),
                edge("slow", "answer-1"),
                edge("fast", "answer-1"),
            ],
        }
        engine = WorkflowEngine(graph=graph)

        engine.execute()

        assert "slow" not in harness.inputs_of("answer-1")
        assert harness.executed.count("answer-1") == 1

    def test_note_nodes_are_ignored(self, harness):
        """note 노드는 연결되지 않아도 검증을 통과하고 실행되지 않는다"""
        graph = linear_graph()
        graph["nodes"].append(node("note-1", "note"))
        engine = WorkflowEngine(graph=graph)

        result = engine.execute()

        assert "note-1" not in result
        assert "note-1" not in harness.executed

    def test_engine_can_be_executed_repeatedly(self, harness):
        """LoopNode처럼 user_input만 바꿔 같은 엔진을 반복 실행할 수 있다"""
        engine = WorkflowEngine(
            graph=linear_graph(),
            user_input={"i": 0},
            execution_context=dict(LOGGED_CONTEXT),
        )

        for i in range(3):
            engine.user_input = {"i": i}
            result = engine.execute()
            assert set(result) == {"start-1", "answer-1"}

        start_inputs = [inp for nid, inp in harness.calls if nid == "start-1"]
        assert start_inputs == [{"i": 0}, {"i": 1}, {"i": 2}]


# ============================================================================
# 3. 에러 / 타임아웃
# ============================================================================


class TestFailures:
    def test_execute_raises_value_error_on_node_failure(self, harness):
        """개발 모드 execute()는 노드 예외를 ValueError(메시지 유지)로 바꿔 던진다"""
        engine = WorkflowEngine(graph=linear_graph(**{"raise": "boom"}))

        with pytest.raises(ValueError, match="boom"):
            engine.execute()

    def test_deployed_execute_propagates_original_exception(self, harness):
        """배포 모드 execute()는 노드의 원래 예외를 그대로 던진다"""
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}), is_deployed=True
        )

        with pytest.raises(RuntimeError, match="boom"):
            engine.execute()

    def test_stream_emits_single_error_event_instead_of_raising(self, harness):
        """스트림 모드는 예외 대신 실패한 node_id가 담긴 error 이벤트를 1번 낸다"""
        engine = WorkflowEngine(graph=linear_graph(**{"raise": "boom"}))

        events = list(engine.execute_stream())

        assert event_summary(events) == [
            ("workflow_start", None),
            ("node_start", "start-1"),
            ("node_finish", "start-1"),
            ("node_start", "answer-1"),
            ("error", "answer-1"),
        ]
        assert events[-1]["data"] == {"node_id": "answer-1", "message": "boom"}

    def test_stream_workflow_timeout_error_has_no_node_id(self, harness):
        """노드 실패가 아닌 에러(전체 타임아웃)의 error 이벤트에는 node_id가 없다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("slow", "templateNode", sleep=5),
            ],
            "edges": [edge("start-1", "slow")],
        }
        engine = WorkflowEngine(graph=graph, workflow_timeout=0.2)

        events = list(engine.execute_stream())

        assert events[-1] == {
            "type": "error",
            "data": {"message": "Workflow timed out after 0.2 seconds."},
        }

    @pytest.mark.parametrize("is_deployed", [True, False])
    def test_failure_kills_running_sibling_nodes(self, harness, is_deployed):
        """한 노드가 실패하면 아직 실행 중인 다른 노드는 중단된다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("bad", "templateNode", sleep=0.05, **{"raise": "boom"}),
                node("slow", "templateNode", sleep=0.3),
            ],
            "edges": [edge("start-1", "bad"), edge("start-1", "slow")],
        }
        engine = WorkflowEngine(graph=graph, is_deployed=is_deployed)

        with pytest.raises(Exception, match="boom"):
            engine.execute()
        gevent.sleep(0.5)

        assert "slow" in harness.executed
        assert "slow" not in harness.finished

    def test_failure_stops_downstream_nodes(self, harness):
        """실패한 노드 이후의 노드는 실행되지 않는다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("bad", "templateNode", **{"raise": "boom"}),
                node("answer-1", "answerNode"),
            ],
            "edges": [edge("start-1", "bad"), edge("bad", "answer-1")],
        }
        engine = WorkflowEngine(graph=graph, is_deployed=True)

        with pytest.raises(RuntimeError):
            engine.execute()

        assert "answer-1" not in harness.executed

    def test_node_timeout(self, harness):
        """노드별 timeout을 넘기면 TimeoutError가 발생한다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("slow", "templateNode", timeout=1, sleep=5),
            ],
            "edges": [edge("start-1", "slow")],
        }
        engine = WorkflowEngine(graph=graph, is_deployed=True)

        with pytest.raises(
            TimeoutError, match=r"Node 'slow' \(templateNode\) timed out"
        ):
            engine.execute()

    def test_workflow_timeout(self, harness):
        """워크플로우 전체 timeout을 넘기면 TimeoutError가 발생한다"""
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("slow", "templateNode", sleep=5),
            ],
            "edges": [edge("start-1", "slow")],
        }
        engine = WorkflowEngine(graph=graph, is_deployed=True, workflow_timeout=0.2)

        with pytest.raises(TimeoutError, match="Workflow timed out after 0.2 seconds"):
            engine.execute()


# ============================================================================
# 4. 실행 로그 (Log-System Celery 태스크)
# ============================================================================


class TestRunLogging:
    def test_no_logs_without_workflow_and_user_id(self, harness):
        """workflow_id/user_id가 없으면 로그 태스크도 Pub/Sub도 발생하지 않는다"""
        engine = WorkflowEngine(graph=linear_graph())

        engine.execute()

        assert harness.log_task_names == []
        assert harness.published == []

    def test_success_log_sequence(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(), execution_context=dict(LOGGED_CONTEXT)
        )

        result = engine.execute()

        assert harness.log_task_names == [
            "log.create_run",
            "log.create_node",
            "log.update_node_finish",
            "log.create_node",
            "log.update_node_finish",
            "log.update_run_finish",
        ]
        tasks = harness.log_tasks
        run_id = tasks[0][1]["run_id"]
        assert tasks[0][1]["workflow_id"] == "wf-1"
        assert tasks[0][1]["is_deployed"] is False
        assert tasks[1][1]["node_id"] == "start-1"
        assert tasks[1][1]["process_data"] == {
            "node_options": {"title": "start-1", "output": {"query": "hi"}},
            "node_title": "start-1",
        }
        assert tasks[2][1]["log_id"] == tasks[1][1]["id"]
        assert tasks[2][1]["outputs"] == {"query": "hi"}
        assert tasks[-1][1] == {
            "run_id": run_id,
            "outputs": result,
            "finished_at": tasks[-1][1]["finished_at"],
        }
        assert engine.execution_context["workflow_run_id"] == run_id

    def test_deployed_run_log_finishes_with_answer_result(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=True,
        )

        engine.execute()

        assert harness.log_tasks[0][1]["is_deployed"] is True
        assert harness.log_tasks[-1][0] == "log.update_run_finish"
        assert harness.log_tasks[-1][1]["outputs"] == {"result": "done"}

    def test_failure_log_sequence(self, harness):
        """노드 실패 시 노드 에러 로그와 run 에러 로그가 각각 1번 전송된다"""
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=True,
        )

        with pytest.raises(RuntimeError):
            engine.execute()

        assert harness.log_task_names == [
            "log.create_run",
            "log.create_node",
            "log.update_node_finish",
            "log.create_node",
            "log.update_node_error",
            "log.update_run_error",
        ]
        assert harness.log_tasks[4][1]["node_id"] == "answer-1"
        assert harness.log_tasks[4][1]["error_message"] == "boom"
        assert harness.log_tasks[-1][1]["error_message"] == "boom"

    def test_external_run_id_is_reused(self, harness):
        """execution_context의 workflow_run_id가 있으면 그 ID로 run log를 만든다"""
        run_id = str(uuid.uuid4())
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context={**LOGGED_CONTEXT, "workflow_run_id": run_id},
        )

        engine.execute()

        assert harness.log_tasks[0][0] == "log.create_run"
        assert harness.log_tasks[0][1]["run_id"] == run_id
        assert {channel for channel, _, _ in harness.published} == {
            f"workflow:{run_id}"
        }

    def test_parent_run_id_attaches_to_parent_run(self, harness):
        """
        parent_run_id가 있으면 부모 run에 붙는다 (LoopNode 서브그래프):
        노드 로그/이벤트는 부모 run으로 나가고, run 자체의 생성/종료는 보고하지 않는다
        """
        parent_run_id = str(uuid.uuid4())
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context=dict(LOGGED_CONTEXT),
            parent_run_id=parent_run_id,
        )

        result = engine.execute()

        assert set(result) == {"start-1", "answer-1"}
        assert harness.log_task_names == [
            "log.create_node",
            "log.update_node_finish",
            "log.create_node",
            "log.update_node_finish",
        ]
        assert {p["workflow_run_id"] for _, p in harness.log_tasks} == {parent_run_id}
        assert harness.published_types == [
            "node_start",
            "node_finish",
            "node_start",
            "node_finish",
        ]
        assert {channel for channel, _, _ in harness.published} == {
            f"workflow:{parent_run_id}"
        }
        assert engine.execution_context["workflow_run_id"] == parent_run_id

    def test_parent_run_id_takes_precedence_over_context_run_id(self, harness):
        """부모 컨텍스트를 복사해 workflow_run_id가 들어 있어도 run log를 새로 만들지 않는다"""
        parent_run_id = str(uuid.uuid4())
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context={**LOGGED_CONTEXT, "workflow_run_id": parent_run_id},
            parent_run_id=parent_run_id,
        )

        engine.execute()

        assert "log.create_run" not in harness.log_task_names
        assert "log.update_run_finish" not in harness.log_task_names
        assert "workflow_finish" not in harness.published_types

    def test_attached_run_failure_only_raises(self, harness):
        """부모 run에 붙은 실행이 실패하면 노드 에러 로그만 남기고 예외를 던진다"""
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}),
            execution_context=dict(LOGGED_CONTEXT),
            parent_run_id=str(uuid.uuid4()),
        )

        with pytest.raises(ValueError, match="boom"):
            engine.execute()

        assert "log.update_node_error" in harness.log_task_names
        assert "log.update_run_error" not in harness.log_task_names
        assert "error" not in harness.published_types

    def test_attached_engine_can_be_executed_repeatedly(self, harness):
        """동결된 execution_context에서도 부모 run에 붙은 엔진을 반복 실행할 수 있다"""
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context=dict(LOGGED_CONTEXT),
            parent_run_id=str(uuid.uuid4()),
        )

        for _ in range(3):
            assert set(engine.execute()) == {"start-1", "answer-1"}

    def test_subworkflow_emits_no_logs_or_events(self, harness):
        """서브 워크플로우는 성공 시 로그 태스크와 Pub/Sub 이벤트를 내지 않는다"""
        parent_run_id = str(uuid.uuid4())
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=True,
            parent_run_id=parent_run_id,
            is_subworkflow=True,
        )

        assert engine.execute() == {"result": "done"}

        assert harness.log_task_names == []
        assert harness.published == []
        assert engine.execution_context["workflow_run_id"] == parent_run_id

    def test_subworkflow_failure_emits_no_logs_or_events(self, harness):
        """서브 워크플로우는 실패해도 예외만 던진다 (부모 run의 에러 처리는 부모 엔진 몫)"""
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=True,
            parent_run_id=str(uuid.uuid4()),
            is_subworkflow=True,
        )

        with pytest.raises(RuntimeError, match="boom"):
            engine.execute()

        assert harness.log_task_names == []
        assert harness.published == []


# ============================================================================
# 5. Redis Pub/Sub 이벤트
# ============================================================================


class TestPubSub:
    def test_success_events(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(), execution_context=dict(LOGGED_CONTEXT)
        )

        result = engine.execute()

        run_id = engine.execution_context["workflow_run_id"]
        assert {channel for channel, _, _ in harness.published} == {
            f"workflow:{run_id}"
        }
        assert harness.published_types == [
            "node_start",
            "node_finish",
            "node_start",
            "node_finish",
            "workflow_finish",
        ]
        assert harness.published[0][2] == {
            "node_id": "start-1",
            "node_type": "startNode",
        }
        assert harness.published[3][2] == {
            "node_id": "answer-1",
            "node_type": "answerNode",
            "output": {"result": "done"},
        }
        assert harness.published[-1][2] == result

    def test_deployed_finish_event_carries_answer_result(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=True,
        )

        engine.execute()

        assert harness.published[-1][1:] == ("workflow_finish", {"result": "done"})

    @pytest.mark.parametrize("is_deployed", [True, False])
    def test_execute_failure_publishes_single_error_event(self, harness, is_deployed):
        """배포/개발 모드 모두 실패 시 error 이벤트와 run 에러 로그가 1번씩 나간다"""
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}),
            execution_context=dict(LOGGED_CONTEXT),
            is_deployed=is_deployed,
        )

        with pytest.raises(Exception, match="boom"):
            engine.execute()

        assert harness.published_types == [
            "node_start",
            "node_finish",
            "node_start",
            "error",
        ]
        assert harness.published[-1][2] == {"message": "boom"}
        assert harness.log_task_names.count("log.update_run_error") == 1

    def test_stream_failure_publishes_single_error_event(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(**{"raise": "boom"}),
            execution_context=dict(LOGGED_CONTEXT),
        )

        list(engine.execute_stream())

        assert harness.published_types.count("error") == 1
        assert harness.log_task_names.count("log.update_run_error") == 1


# ============================================================================
# 6. 그래프 검증 (생성 시점)
# ============================================================================


class TestGraphValidation:
    def test_no_start_node(self, harness):
        graph = {"nodes": [node("answer-1", "answerNode")], "edges": []}

        with pytest.raises(ValueError, match="시작 노드.*없습니다"):
            WorkflowEngine(graph=graph)

    def test_empty_graph(self, harness):
        with pytest.raises(ValueError, match="시작 노드.*없습니다"):
            WorkflowEngine(graph={"nodes": [], "edges": []})

    def test_multiple_trigger_nodes(self, harness):
        graph = {
            "nodes": [node("start-1", "startNode"), node("hook-1", "webhookTrigger")],
            "edges": [],
        }

        with pytest.raises(ValueError, match="시작 노드가 2개"):
            WorkflowEngine(graph=graph)

    @pytest.mark.parametrize(
        "trigger_type", ["startNode", "webhookTrigger", "scheduleTrigger"]
    )
    def test_trigger_types_are_start_nodes(self, harness, trigger_type):
        graph = {
            "nodes": [node("trigger-1", trigger_type), node("answer-1", "answerNode")],
            "edges": [edge("trigger-1", "answer-1")],
        }
        engine = WorkflowEngine(graph=graph, user_input={"k": "v"})

        engine.execute()

        assert harness.executed[0] == "trigger-1"
        assert harness.inputs_of("trigger-1") == {"k": "v"}

    def test_cycle(self, harness):
        graph = {
            "nodes": [
                node("start-1", "startNode"),
                node("a", "templateNode"),
                node("b", "templateNode"),
            ],
            "edges": [edge("start-1", "a"), edge("a", "b"), edge("b", "a")],
        }

        with pytest.raises(ValueError, match="순환"):
            WorkflowEngine(graph=graph)

    def test_isolated_node(self, harness):
        graph = linear_graph()
        graph["nodes"].append(node("orphan", "templateNode"))

        with pytest.raises(ValueError, match="고립된 노드.*orphan"):
            WorkflowEngine(graph=graph)

    def test_unregistered_node_type(self):
        """등록되지 않은 노드 타입은 생성 시점에 NotImplementedError (실제 NodeFactory 사용)"""
        graph = {
            "nodes": [node("start-1", "startNode"), node("x", "noSuchNode")],
            "edges": [edge("start-1", "x")],
        }

        with pytest.raises(NotImplementedError, match="Cannot create node 'x'"):
            WorkflowEngine(graph=graph)


# ============================================================================
# 7. cleanup
# ============================================================================


class TestCleanup:
    def test_cleanup_after_execute(self, harness):
        engine = WorkflowEngine(
            graph=linear_graph(), execution_context=dict(LOGGED_CONTEXT)
        )
        engine.execute()

        engine.cleanup()

        assert engine.node_instances == {}
        assert engine.execution_context is None
        assert engine.user_input is None

    def test_cleanup_cascades_to_loop_subgraph_engine(self, harness):
        """노드가 들고 있는 _subgraph_engine(LoopNode)도 함께 정리한다"""
        engine = WorkflowEngine(graph=linear_graph())
        sub_engine = MagicMock()
        loop_node = engine.node_instances["answer-1"]
        loop_node._subgraph_engine = sub_engine

        engine.cleanup()

        sub_engine.cleanup.assert_called_once()
        assert loop_node._subgraph_engine is None
