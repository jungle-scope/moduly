"""
OpenAIClient 단위 테스트.
- 성공 시 HTTP 응답을 그대로 반환하는지
- 4xx/5xx일 때 ValueError를 발생시키는지
- 토큰 카운트가 최소 1 이상으로 계산되는지 검증
"""

import pathlib
import sys
from types import SimpleNamespace

import pytest

# pytest 실행 시 모듈 검색 경로에 프로젝트 루트를 추가
ROOT = pathlib.Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from apps.gateway.services.llm_client.openai_client import OpenAIClient


def test_openai_invoke_success(monkeypatch):
    messages = [{"role": "user", "content": "hi"}]
    dummy_response = {"id": "abc", "choices": []}

    def fake_post(url, headers=None, json=None, timeout=None):
        return SimpleNamespace(
            status_code=200,
            text=json and repr(json) or "",
            json=lambda: dummy_response,
        )

    monkeypatch.setattr(
        "apps.gateway.services.llm_client.openai_client.requests.post", fake_post
    )

    client = OpenAIClient(
        model_id="gpt-4o",
        credentials={"apiKey": "sk-test", "baseUrl": "https://api.openai.com/v1"},
    )
    resp = client.invoke(messages)
    assert resp == dummy_response


def test_openai_invoke_failure(monkeypatch):
    messages = [{"role": "user", "content": "hi"}]

    def fake_post(url, headers=None, json=None, timeout=None):
        return SimpleNamespace(status_code=401, text="unauthorized")

    monkeypatch.setattr(
        "apps.gateway.services.llm_client.openai_client.requests.post", fake_post
    )

    client = OpenAIClient(
        model_id="gpt-4o",
        credentials={"apiKey": "sk-test", "baseUrl": "https://api.openai.com/v1"},
    )
    with pytest.raises(ValueError):
        client.invoke(messages)


def test_openai_token_estimate():
    # tiktoken 호출을 모킹해 네트워크 접근을 막고 결정적 결과만 확인
    class DummyEnc:
        def encode(self, text):
            return list(text)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(
        "apps.gateway.services.llm_client.openai_client.tiktoken.encoding_for_model",
        lambda *_args, **_kwargs: DummyEnc(),
    )
    monkeypatch.setattr(
        "apps.gateway.services.llm_client.openai_client.tiktoken.get_encoding",
        lambda *_args, **_kwargs: DummyEnc(),
    )

    client = OpenAIClient(
        model_id="gpt-4o",
        credentials={"apiKey": "sk-test", "baseUrl": "https://api.openai.com/v1"},
    )
    messages = [{"role": "user", "content": "hello world"}]
    tokens = client.get_num_tokens(messages)
    assert tokens >= 1
