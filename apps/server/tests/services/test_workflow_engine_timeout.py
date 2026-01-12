# """
# WorkflowEngine Timeout 테스트

# 실행 방법:
#     python -m pytest tests/services/test_workflow_engine_timeout.py -vs
# """

# import asyncio
# from unittest.mock import MagicMock, patch

# import pytest

# from workflow.core.workflow_engine import WorkflowEngine

# # ============================================================================
# # Fixtures
# # ============================================================================


# @pytest.fixture
# def mock_logger():
#     """WorkflowLogger Mock"""
#     with patch("workflow.core.workflow_engine.WorkflowLogger") as MockLogger:
#         mock_instance = MagicMock()
#         mock_instance.create_run_log.return_value = None
#         mock_instance.workflow_run_id = None
#         MockLogger.return_value = mock_instance
#         yield mock_instance


# @pytest.fixture
# def slow_node_graph():
#     """타임아웃 테스트를 위한 그래프 (Start -> Answer)"""
#     return {
#         "nodes": [
#             {
#                 "id": "start-1",
#                 "type": "startNode",
#                 "position": {"x": 0, "y": 0},
#                 "data": {"title": "시작"},
#             },
#             {
#                 "id": "answer-1",
#                 "type": "answerNode",
#                 "position": {"x": 200, "y": 0},
#                 "data": {"title": "응답", "outputs": []},
#                 # 테스트 시 동적으로 timeout 필드를 추가할 예정
#             },
#         ],
#         "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#     }


# # ============================================================================
# # Tests
# # ============================================================================


# @pytest.mark.asyncio
# async def test_global_workflow_timeout(slow_node_graph, mock_logger):
#     """전체 워크플로우 타임아웃 발생 시 TimeoutError가 발생해야 한다."""

#     # 1. 0.1초 타임아웃 설정
#     engine = WorkflowEngine(
#         graph=slow_node_graph,
#         workflow_timeout=1,  # 1초 타임아웃 (넉넉하게 잡고 내부에서 mock으로 시간 조작)
#     )
#     # 실제로는 0.1초만 기다리게 설정하고 싶으나, async loop 안에서의 time.time() 조작이 까다로움.
#     # 대신 엔진 초기화 시 매우 짧은 타임아웃을 주거나,
#     # _execute_node_task_sync에서 시간을 많이 소비하도록 함.

#     # 1초 타임아웃 설정
#     engine = WorkflowEngine(graph=slow_node_graph, workflow_timeout=1)

#     # 2. 노드 실행이 1.5초 걸리도록 Mock
#     async def slow_execute(*args, **kwargs):
#         await asyncio.sleep(1.5)
#         return {}

#     # _task_wrapper 내부의 동기 실행을 감싸는 부분을 mock할 수는 없으니
#     # _task_wrapper_with_event가 호출하는 _execute_node_task_sync를 지연시키는 것이 아니라
#     # loop.run_in_executor가 실행하는 함수 자체를 지연.

#     def slow_sync_execute(node_id, node_schema, node_instance, inputs):
#         import time

#         time.sleep(1.5)  # 1.5초 지연 (Blocking)
#         return {}

#     # 주의: Blocking sleep은 loop를 막지 않기 위해 executor에서 실행됨.
#     # 하지만 WorkflowEngine 메인 루프에서 타임아웃 체크는 "task 완료 후" 또는 "timeout 체크용 주기적 polling"이 있어야 함.
#     # 현재 구현된 로직: while running_tasks 루프에서 done을 기다림 (0.05초 타임아웃).
#     # 따라서 0.05초마다 루프가 돌면서 전체 타임아웃을 체크함.

#     with patch.object(engine, "_execute_node_task_sync", side_effect=slow_sync_execute):
#         with pytest.raises(ValueError, match="Workflow timed out"):
#             # execute() 내부에서 loop가 돌면서 타임아웃 감지
#             await engine.execute()


# @pytest.mark.asyncio
# async def test_node_execution_timeout(slow_node_graph, mock_logger):
#     """개별 노드 타임아웃 발생 시 TimeoutError가 발생해야 한다."""

#     # 1. 노드 스키마에 타임아웃 설정 (1초)
#     # slow_node_graph는 딕셔너리이므로 직접 수정
#     slow_node_graph["nodes"][1]["timeout"] = 1  # answer-1 노드에 1초 타임아웃

#     engine = WorkflowEngine(graph=slow_node_graph)

#     # 2. 노드 실행이 2초 걸리도록 Mock (비동기적으로 sleep하여 asyncio.wait_for에 걸리게 함)
#     # 내부적으로 run_in_executor를 쓰므로, 거기서 sleep하면 wait_for가 작동함.

#     def slow_sync_execute(node_id, node_schema, node_instance, inputs):
#         if node_id == "answer-1":
#             import time

#             time.sleep(2.0)
#         return {}

#     with patch.object(engine, "_execute_node_task_sync", side_effect=slow_sync_execute):
#         with pytest.raises(ValueError, match="Node 'answer-1' .* timed out"):
#             await engine.execute()
