# """
# 워크플로우 에러 케이스 테스트

# 다양한 예외 및 에러 상황에 대한 워크플로우 엔진의 처리를 검증합니다.
# - 시작 노드 관련 에러
# - 순환 참조 감지
# - 노드 실행 타임아웃
# - 외부 서비스 연결 실패
# - LLM API 에러 처리

# 실행 방법:
#     cd apps/server
#     source .venv/bin/activate
#     python -m pytest tests/services/test_workflow_error_cases.py -vs --asyncio-mode=auto
# """

# from unittest.mock import MagicMock, patch

# import pytest

# from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

# # ============================================================================
# # Fixtures
# # ============================================================================


# @pytest.fixture
# def mock_logger():
#     """WorkflowLogger Mock"""
#     with patch("apps.workflow_engine.workflow.core.workflow_engine.WorkflowLogger") as MockLogger:
#         mock_instance = MagicMock()
#         mock_instance.create_run_log.return_value = None
#         mock_instance.workflow_run_id = None
#         MockLogger.return_value = mock_instance
#         yield mock_instance


# # ============================================================================
# # 1. 시작 노드 관련 에러 테스트
# # ============================================================================


# class TestStartNodeErrors:
#     """시작 노드 관련 에러 처리 테스트"""

#     def test_no_start_node_raises_error(self, mock_logger):
#         """시작 노드가 없는 워크플로우는 ValueError 발생"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "응답", "outputs": []},
#                 },
#             ],
#             "edges": [],
#         }

#         with pytest.raises(ValueError, match="시작 노드.*없습니다"):
#             WorkflowEngine(graph=graph)

#     def test_multiple_start_nodes_raises_error(self, mock_logger):
#         """시작 노드가 2개 이상인 워크플로우는 ValueError 발생"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작1"},
#                 },
#                 {
#                     "id": "start-2",
#                     "type": "startNode",
#                     "position": {"x": 100, "y": 0},
#                     "data": {"title": "시작2"},
#                 },
#             ],
#             "edges": [],
#         }

#         with pytest.raises(ValueError, match="시작 노드가 2개"):
#             WorkflowEngine(graph=graph)

#     def test_start_and_webhook_trigger_count_as_multiple(self, mock_logger):
#         """startNode와 webhookTrigger가 동시에 있으면 에러"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작"},
#                 },
#                 {
#                     "id": "webhook-1",
#                     "type": "webhookTrigger",
#                     "position": {"x": 100, "y": 0},
#                     "data": {"title": "웹훅"},
#                 },
#             ],
#             "edges": [],
#         }

#         with pytest.raises(ValueError, match="시작 노드가 2개"):
#             WorkflowEngine(graph=graph)

#     @pytest.mark.asyncio
#     async def test_execute_without_start_node_fails(self, mock_logger):
#         """시작 노드 없이 execute() 호출 시 에러"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "템플릿", "template": "Hello"},
#                 },
#             ],
#             "edges": [],
#         }

#         with pytest.raises(ValueError, match="시작 노드.*없습니다"):
#             WorkflowEngine(graph=graph)


# # ============================================================================
# # 2. 배포 모드 AnswerNode 에러 테스트
# # ============================================================================


# class TestDeployedModeErrors:
#     """배포 모드 관련 에러 테스트"""

#     @pytest.mark.asyncio
#     async def test_deployed_mode_without_answer_node_raises_error(self, mock_logger):
#         """배포 모드에서 AnswerNode 없으면 에러"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "템플릿", "template": "Hello", "variables": []},
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "template-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={}, is_deployed=True)

#         with pytest.raises(ValueError, match="AnswerNode"):
#             await engine.execute()

#     @pytest.mark.asyncio
#     async def test_deployed_mode_answer_not_executed_raises_error(self, mock_logger):
#         """배포 모드에서 AnswerNode가 실행되지 않으면 에러"""
#         # AnswerNode는 있지만 연결이 없어서 실행되지 않는 경우
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "템플릿", "template": "Hi", "variables": []},
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 100},
#                     "data": {"title": "응답", "outputs": []},
#                     # answer-1이 연결되지 않음 - start → template만 연결
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "template-1"}],
#         }

#         # 배포 모드에서도 고립된 노드가 있으면 초기화 시 검증 에러 발생
#         with pytest.raises(ValueError, match="고립된 노드"):
#             WorkflowEngine(graph=graph, user_input={}, is_deployed=True)


# # ============================================================================
# # 3. 노드 실행 에러 테스트
# # ============================================================================


# class TestNodeExecutionErrors:
#     """노드 실행 중 에러 처리 테스트"""

#     @pytest.mark.asyncio
#     async def test_node_exception_propagates_as_value_error(self, mock_logger):
#         """노드 실행 중 예외 발생 시 ValueError로 래핑"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {
#                         "title": "시작",
#                         "variables": [
#                             {"id": "v1", "name": "x", "type": "text", "label": "X"}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {"variable": "result", "value_selector": ["start-1", "x"]}
#                         ],
#                     },
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={"x": "test"})

#         # 노드 실행 시 강제로 예외 발생
#         def raise_error(*args, **kwargs):
#             raise RuntimeError("노드 내부 오류 발생")

#         with patch.object(engine, "_execute_node_task_sync", side_effect=raise_error):
#             with pytest.raises(ValueError, match="노드 내부 오류 발생"):
#                 await engine.execute()

#     @pytest.mark.asyncio
#     async def test_stream_mode_reports_error_event(self, mock_logger):
#         """스트리밍 모드에서 에러 발생 시 error 이벤트 반환"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "응답", "outputs": []},
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={})

#         def raise_error(node_id, *args, **kwargs):
#             if node_id == "answer-1":
#                 raise Exception("테스트 에러")
#             return {}

#         with patch.object(engine, "_execute_node_task_sync", side_effect=raise_error):
#             events = []
#             async for event in engine.execute_stream():
#                 events.append(event)

#             # error 이벤트가 발생해야 함
#             error_events = [e for e in events if e["type"] == "error"]
#             assert len(error_events) >= 1
#             assert "테스트 에러" in error_events[0]["data"]["message"]


# # ============================================================================
# # 4. LLM API 에러 처리 테스트
# # ============================================================================


# class TestLLMNodeErrors:
#     """LLM 노드 관련 에러 처리 테스트"""

#     @pytest.mark.asyncio
#     async def test_llm_api_failure_propagates(self, mock_logger):
#         """LLM API 호출 실패 시 에러가 워크플로우에 전파되는지 확인"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {
#                         "title": "시작",
#                         "variables": [
#                             {
#                                 "id": "v1",
#                                 "name": "query",
#                                 "type": "text",
#                                 "label": "Query",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "result",
#                                 "value_selector": ["start-1", "query"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={"query": "hello"})

#         # 엔진 레벨에서 LLM API 에러 시뮬레이션
#         call_count = 0

#         def simulate_llm_error(node_id, node_schema, node_instance, inputs):
#             nonlocal call_count
#             call_count += 1
#             if call_count > 1:  # 두 번째 노드 호출 시 에러
#                 raise Exception("OpenAI API rate limit exceeded")
#             return node_instance.execute(inputs)

#         with patch.object(
#             engine, "_execute_node_task_sync", side_effect=simulate_llm_error
#         ):
#             with pytest.raises((ValueError, Exception)):
#                 await engine.execute()


# # ============================================================================
# # 5. HTTP 노드 에러 처리 테스트
# # ============================================================================


# class TestHttpNodeErrors:
#     """HTTP 노드 관련 에러 처리 테스트"""

#     @pytest.mark.asyncio
#     async def test_http_connection_timeout(self, mock_logger):
#         """HTTP 연결 타임아웃 시 에러가 워크플로우에 전파되는지 확인"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "응답", "outputs": []},
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={})

#         # 엔진 레벨에서 HTTP 타임아웃 시뮬레이션
#         call_count = 0

#         def simulate_timeout(node_id, node_schema, node_instance, inputs):
#             nonlocal call_count
#             call_count += 1
#             if call_count > 1:  # 두 번째 노드 호출 시 타임아웃
#                 raise TimeoutError("Connection timed out")
#             return node_instance.execute(inputs)

#         with patch.object(
#             engine, "_execute_node_task_sync", side_effect=simulate_timeout
#         ):
#             with pytest.raises((ValueError, TimeoutError)):
#                 await engine.execute()


# # ============================================================================
# # 6. 잘못된 그래프 구조 테스트
# # ============================================================================


# class TestInvalidGraphStructure:
#     """잘못된 그래프 구조 처리 테스트"""

#     def test_empty_graph(self, mock_logger):
#         """빈 그래프 처리"""
#         graph = {"nodes": [], "edges": []}

#         with pytest.raises(ValueError, match="시작 노드.*없습니다"):
#             WorkflowEngine(graph=graph)

#     def test_edge_to_nonexistent_node(self, mock_logger):
#         """존재하지 않는 노드로의 엣지 처리"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작"},
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "nonexistent-node"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={})

#         # 다음 노드 탐색 시 존재하지 않는 노드는 무시됨 (에러 아닌 빈 리스트)
#         # 그래프 구조상 문제가 있지만 엔진은 graceful하게 처리
#         next_nodes = engine._get_next_nodes("start-1", {})
#         assert "nonexistent-node" in next_nodes  # 엣지는 존재

#     @pytest.mark.asyncio
#     async def test_unreachable_answer_node(self, mock_logger):
#         """도달할 수 없는 AnswerNode가 있는 경우"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "템플릿", "template": "Hi", "variables": []},
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 100},
#                     "data": {"title": "응답", "outputs": []},
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 # answer-1로 가는 엣지 없음
#             ],
#         }

#         with pytest.raises(ValueError, match="고립된 노드"):
#             WorkflowEngine(graph=graph, user_input={}, is_deployed=True)


# # ============================================================================
# # 7. 동시성 및 타이밍 관련 테스트
# # ============================================================================


# class TestConcurrencyIssues:
#     """동시성 및 타이밍 관련 에러 테스트"""

#     @pytest.mark.asyncio
#     async def test_long_running_node_completes(self, mock_logger):
#         """오래 실행되는 노드도 정상 완료되는지 확인"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {
#                         "title": "시작",
#                         "variables": [
#                             {"id": "v1", "name": "x", "type": "text", "label": "X"}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {"variable": "result", "value_selector": ["start-1", "x"]}
#                         ],
#                     },
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={"x": "slow"}, is_deployed=True)

#         original_execute = engine._execute_node_task_sync

#         def slow_execute(node_id, node_schema, node_instance, inputs):
#             import time

#             time.sleep(0.1)  # 100ms 지연
#             return original_execute(node_id, node_schema, node_instance, inputs)

#         with patch.object(engine, "_execute_node_task_sync", side_effect=slow_execute):
#             result = await engine.execute()

#         assert result is not None
#         assert result["result"] == "slow"


# # ============================================================================
# # 8. 입력 검증 테스트
# # ============================================================================


# class TestInputValidation:
#     """입력 데이터 검증 테스트"""

#     @pytest.mark.asyncio
#     async def test_missing_required_variable(self, mock_logger):
#         """필수 변수 누락 시 처리 (StartNode의 number 타입 변환 실패)"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {
#                         "title": "시작",
#                         "variables": [
#                             {
#                                 "id": "v1",
#                                 "name": "count",
#                                 "type": "number",
#                                 "label": "Count",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "result",
#                                 "value_selector": ["start-1", "count"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         # 숫자가 아닌 값 전달
#         engine = WorkflowEngine(
#             graph=graph, user_input={"count": "not_a_number"}, is_deployed=True
#         )

#         with pytest.raises((ValueError, Exception)):
#             await engine.execute()

#     @pytest.mark.asyncio
#     async def test_empty_user_input(self, mock_logger):
#         """빈 user_input 처리"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {"title": "시작", "variables": []},
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {"title": "응답", "outputs": []},
#                 },
#             ],
#             "edges": [{"id": "e1", "source": "start-1", "target": "answer-1"}],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={}, is_deployed=True)

#         # 에러 없이 정상 완료
#         result = await engine.execute()
#         assert result is not None
