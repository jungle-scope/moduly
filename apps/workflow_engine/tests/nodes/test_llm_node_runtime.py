"""
LLM 노드 런타임 최소 동작 테스트 [GEVENT] Sync 버전.
- 메시지 렌더링 → 클라이언트 호출 → 응답 파싱 경로를 검증한다.
- DB 세션 없이도 _client_override로 클라이언트를 주입해 실행 가능하도록 구성.
"""

import pathlib
import sys
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
PARENT_OF_ROOT = ROOT.parent
for p in [ROOT, PARENT_OF_ROOT]:
    if str(p) not in sys.path:
        sys.path.append(str(p))

from apps.workflow_engine.services.llm_service import LLMService
from apps.workflow_engine.workflow.nodes.llm.entities import LLMNodeData, LLMVariable
from apps.workflow_engine.workflow.nodes.llm.llm_node import (
    SAFETY_SYSTEM_PROMPT,
    LLMNode,
)


class DummyClient:
    """동기 더미 클라이언트 [GEVENT]"""

    def __init__(self):
        self.calls = []

    def invoke_sync(self, messages, **kwargs):
        """동기 호출 메서드"""
        self.calls.append({"messages": messages, "kwargs": kwargs})
        return {
            "choices": [{"message": {"content": "hello world"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1},
        }


class FailingClient:
    """동기 실패 클라이언트 [GEVENT]"""

    def __init__(self):
        self.calls = []

    def invoke_sync(self, messages, **kwargs):
        """동기 호출 - 실패"""
        self.calls.append({"messages": messages, "kwargs": kwargs})
        raise RuntimeError("primary model failed")


class SuccessClient:
    """동기 성공 클라이언트 [GEVENT]"""

    def __init__(self):
        self.calls = []

    def invoke_sync(self, messages, **kwargs):
        """동기 호출 - 성공"""
        self.calls.append({"messages": messages, "kwargs": kwargs})
        return {
            "choices": [{"message": {"content": "fallback ok"}}],
            "usage": {},
        }


def test_llm_node_runs_with_override_client():
    """클라이언트 오버라이드로 LLM 노드 실행 테스트 [GEVENT] sync"""
    dummy_client = DummyClient()

    data = LLMNodeData(
        title="LLM",
        provider="openai",
        model_id="gpt-4o",
        system_prompt="sys {{var}}",
        user_prompt="user {{var}}",
        assistant_prompt="assistant {{var}}",
        referenced_variables=[
            LLMVariable(name="var", value_selector=["some_node", "var"])
        ],
        context_variable=None,
        parameters={},
    )

    node = LLMNode("llm-1", data)
    # DB 세션 대신 직접 클라이언트 주입
    node._client_override = dummy_client  # noqa: SLF001 - 테스트용

    # value_selector가 ["some_node", "var"]이므로 some_node의 var 값을 전달
    # [GEVENT] sync 호출
    result = node.execute({"some_node": {"var": "X"}})

    # 클라이언트 호출 검증
    assert dummy_client.calls
    called = dummy_client.calls[0]
    assert called["messages"] == [
        {"role": "system", "content": SAFETY_SYSTEM_PROMPT},
        {"role": "system", "content": "sys X"},
        {"role": "user", "content": "user X"},
        {"role": "assistant", "content": "assistant X"},
    ]

    # 응답 파싱 검증
    assert result["text"] == "hello world"
    assert result["usage"] == {"prompt_tokens": 1, "completion_tokens": 1}


def test_llm_node_uses_fallback_model_on_failure(monkeypatch):
    """폴백 모델 사용 테스트 [GEVENT] sync"""
    primary_client = FailingClient()
    fallback_client = SuccessClient()

    def fake_get_client_for_user(db, user_id, model_id):
        if model_id == "primary-model":
            return primary_client
        if model_id == "fallback-model":
            return fallback_client
        raise AssertionError(f"unexpected model_id: {model_id}")

    monkeypatch.setattr(LLMService, "get_client_for_user", fake_get_client_for_user)

    data = LLMNodeData(
        title="LLM",
        provider="openai",
        model_id="primary-model",
        fallback_model_id="fallback-model",
        system_prompt="sys",
        user_prompt="user",
        assistant_prompt=None,
        referenced_variables=[],
        context_variable=None,
        parameters={},
    )

    node = LLMNode("llm-1", data, execution_context={"user_id": str(uuid.uuid4())})
    node.db = object()  # DB 세션 생성 방지

    # [GEVENT] sync 호출
    result = node.execute({})

    assert primary_client.calls
    assert fallback_client.calls
    assert result["text"] == "fallback ok"
    assert result["model"] == "fallback-model"
