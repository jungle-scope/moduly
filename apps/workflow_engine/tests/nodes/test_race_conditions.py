"""
Race Condition Safety Tests

Tests for race condition mitigations introduced in Fix #3 and Fix #4:
- Fix #3: Redis client singleton thread-safe lazy initialization
- Fix #4: execution_context immutability after workflow start
"""

import threading
import types
from unittest.mock import MagicMock, patch

import pytest

# ============================================================================
# Fix #3: Redis Singleton Thread-Safety
# ============================================================================


class TestRedisClientSingleton:
    """get_redis_client()와 get_async_redis_client()의 thread-safe 싱글톤 테스트"""

    @patch("apps.shared.pubsub.redis.from_url")
    def test_concurrent_get_redis_client_creates_single_instance(self, mock_from_url):
        """
        여러 스레드가 동시에 get_redis_client()를 호출해도
        Redis 클라이언트는 정확히 1개만 생성되어야 합니다.
        """
        import apps.shared.pubsub as pubsub_module

        # Reset singleton state
        original = pubsub_module._redis_client
        pubsub_module._redis_client = None

        try:
            mock_client = MagicMock()
            mock_from_url.return_value = mock_client

            results = []
            errors = []
            barrier = threading.Barrier(20)

            def call_get_client():
                try:
                    barrier.wait(timeout=5)
                    client = pubsub_module.get_redis_client()
                    results.append(client)
                except Exception as e:
                    errors.append(e)

            threads = [threading.Thread(target=call_get_client) for _ in range(20)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10)

            assert not errors, f"Unexpected errors: {errors}"
            # All threads should get the same instance
            assert all(r is results[0] for r in results)
            # redis.from_url should be called exactly once
            mock_from_url.assert_called_once()
        finally:
            pubsub_module._redis_client = original

    @patch("apps.shared.pubsub.aioredis.from_url")
    def test_concurrent_get_async_redis_client_creates_single_instance(
        self, mock_from_url
    ):
        """
        여러 스레드가 동시에 get_async_redis_client()를 호출해도
        비동기 Redis 클라이언트는 정확히 1개만 생성되어야 합니다.
        """
        import apps.shared.pubsub as pubsub_module

        original = pubsub_module._async_redis_client
        pubsub_module._async_redis_client = None

        try:
            mock_client = MagicMock()
            mock_from_url.return_value = mock_client

            results = []
            barrier = threading.Barrier(20)

            def call_get_client():
                barrier.wait(timeout=5)
                client = pubsub_module.get_async_redis_client()
                results.append(client)

            threads = [threading.Thread(target=call_get_client) for _ in range(20)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10)

            assert all(r is results[0] for r in results)
            mock_from_url.assert_called_once()
        finally:
            pubsub_module._async_redis_client = original


# ============================================================================
# Fix #4: execution_context Immutability
# ============================================================================


class TestExecutionContextFreeze:
    """execution_context가 워크플로우 실행 중에 읽기 전용으로 동결되는지 테스트"""

    def test_mapping_proxy_rejects_writes(self):
        """MappingProxyType은 쓰기 시도 시 TypeError를 발생시켜야 합니다."""
        original = {"key": "value", "nested": {"a": 1}}
        frozen = types.MappingProxyType(original)

        # 읽기는 정상 동작
        assert frozen["key"] == "value"
        assert frozen.get("nested") == {"a": 1}

        # 쓰기 시도는 TypeError 발생
        with pytest.raises(TypeError):
            frozen["new_key"] = "new_value"

        with pytest.raises(TypeError):
            del frozen["key"]

    def test_frozen_context_supports_dict_conversion(self):
        """
        동결된 execution_context는 dict()로 변환 가능해야 합니다.
        (LoopNode 등에서 서브 워크플로우에 전달 시 사용)
        """
        original = {"user_id": "u1", "workflow_run_id": "r1", "db": "session_obj"}
        frozen = types.MappingProxyType(original)

        # dict() 변환으로 새로운 mutable dict 생성
        copied = dict(frozen)
        assert copied == original
        assert isinstance(copied, dict)

        # 복사본은 수정 가능
        copied["new_key"] = "new_value"
        assert "new_key" not in frozen

    def test_frozen_context_supports_get_and_iteration(self):
        """동결된 context에서 .get(), in, iteration이 정상 동작해야 합니다."""
        frozen = types.MappingProxyType({"a": 1, "b": 2, "c": 3})

        assert frozen.get("a") == 1
        assert frozen.get("missing") is None
        assert frozen.get("missing", "default") == "default"
        assert "a" in frozen
        assert "z" not in frozen
        assert set(frozen.keys()) == {"a", "b", "c"}
        assert list(frozen.values()) == [1, 2, 3]

    def test_execute_core_freezes_context(self):
        """_execute_core() 실행 후 execution_context가 MappingProxyType인지 확인"""
        from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

        # 최소 그래프: startNode만
        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "Start"},
                }
            ],
            "edges": [],
        }

        # Mock node factory to avoid real node creation
        with patch.object(WorkflowEngine, "_build_node_instances"):
            engine = WorkflowEngine(
                graph=graph,
                user_input={},
                execution_context={"user_id": "test-user", "workflow_id": "wf-1"},
            )

        # Manually add a mock start node
        mock_node = MagicMock()
        mock_node.execute.return_value = {}
        engine.node_instances["start-1"] = mock_node

        # Mock logger to prevent Celery/Redis connection during test
        engine.logger = MagicMock()

        # Execute (consumes the generator)
        with patch(
            "apps.workflow_engine.workflow.core.workflow_engine.publish_workflow_event"
        ):
            for event in engine._execute_core(stream_mode=False):
                pass

        # After execution, context should be frozen
        assert isinstance(engine.execution_context, types.MappingProxyType)

    def test_cleanup_handles_frozen_context(self):
        """cleanup()이 동결된 execution_context를 정상적으로 처리해야 합니다."""
        from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

        graph = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {"title": "Start"},
                }
            ],
            "edges": [],
        }

        with patch.object(WorkflowEngine, "_build_node_instances"):
            engine = WorkflowEngine(
                graph=graph,
                user_input={},
                execution_context={"user_id": "test-user"},
            )

        mock_node = MagicMock()
        mock_node.execute.return_value = {}
        engine.node_instances["start-1"] = mock_node

        # Execute then cleanup — should not raise
        with patch(
            "apps.workflow_engine.workflow.core.workflow_engine.publish_workflow_event"
        ):
            for event in engine._execute_core(stream_mode=False):
                pass

        engine.cleanup()
        assert engine.execution_context is None
