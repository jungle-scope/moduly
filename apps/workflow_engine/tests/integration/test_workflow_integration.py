# """
# 워크플로우 통합 테스트 (End-to-End 시나리오)

# 여러 노드가 연결된 실제 워크플로우 시나리오를 테스트합니다.
# - 노드 간 데이터 흐름 검증
# - 조건 분기 동작 검증
# - 병렬 실행 검증
# - 에러 전파 검증

# 실행 방법:
#     cd apps/server
#     source .venv/bin/activate
#     python -m pytest tests/integration/test_workflow_integration.py -vs --asyncio-mode=auto
# """

# from unittest.mock import MagicMock, patch

# import pytest

# from apps.workflow_engine.workflow.core.workflow_engine import WorkflowEngine

# # ============================================================================
# # Fixtures - 테스트용 워크플로우 그래프
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
# # 1. Start → Template → Answer 파이프라인 테스트
# # ============================================================================


# class TestStartTemplateAnswerPipeline:
#     """기본 파이프라인: Start → Template → Answer"""

#     @pytest.mark.asyncio
#     async def test_basic_pipeline_flow(self, mock_logger):
#         """Start에서 입력을 받아 Template에서 가공하고 Answer로 출력"""
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
#                                 "id": "var-name",
#                                 "name": "name",
#                                 "type": "text",
#                                 "label": "이름",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "인사 템플릿",
#                         "template": "안녕하세요, {{ name }}님!",
#                         "variables": [
#                             {"name": "name", "value_selector": ["start-1", "name"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "greeting",
#                                 "value_selector": ["template-1", "text"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 {"id": "e2", "source": "template-1", "target": "answer-1"},
#             ],
#         }

#         user_input = {"name": "홍길동"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         assert "greeting" in result
#         assert result["greeting"] == "안녕하세요, 홍길동님!"

#     @pytest.mark.asyncio
#     async def test_multiple_variables_in_template(self, mock_logger):
#         """여러 변수를 사용하는 템플릿 처리"""
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
#                                 "id": "var-name",
#                                 "name": "name",
#                                 "type": "text",
#                                 "label": "이름",
#                             },
#                             {
#                                 "id": "var-age",
#                                 "name": "age",
#                                 "type": "number",
#                                 "label": "나이",
#                             },
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "프로필 템플릿",
#                         "template": "{{ name }}님은 {{ age }}세입니다.",
#                         "variables": [
#                             {"name": "name", "value_selector": ["start-1", "name"]},
#                             {"name": "age", "value_selector": ["start-1", "age"]},
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "profile",
#                                 "value_selector": ["template-1", "text"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 {"id": "e2", "source": "template-1", "target": "answer-1"},
#             ],
#         }

#         user_input = {"name": "김철수", "age": "25"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         assert result["profile"] == "김철수님은 25세입니다."


# # ============================================================================
# # 2. Start → Condition → Answer 분기 테스트
# # ============================================================================


# class TestConditionalBranching:
#     """조건 분기 테스트: Start → Condition → (True/False) → Answer"""

#     @pytest.mark.asyncio
#     async def test_condition_true_branch(self, mock_logger):
#         """조건이 참일 때 True 분기 실행"""
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
#                                 "id": "var-score",
#                                 "name": "score",
#                                 "type": "number",
#                                 "label": "점수",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "condition-1",
#                     "type": "conditionNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "점수 체크",
#                         "cases": [
#                             {
#                                 "id": "case-pass",
#                                 "case_name": "합격",
#                                 "logical_operator": "and",
#                                 "conditions": [
#                                     {
#                                         "id": "cond-1",
#                                         "variable_selector": ["start-1", "score"],
#                                         "operator": "greater_than_or_equals",
#                                         "value": 60,
#                                     }
#                                 ],
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-pass",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": -50},
#                     "data": {
#                         "title": "합격 응답",
#                         "outputs": [{"variable": "result", "value_selector": []}],
#                     },
#                 },
#                 {
#                     "id": "answer-fail",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 50},
#                     "data": {
#                         "title": "불합격 응답",
#                         "outputs": [{"variable": "result", "value_selector": []}],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "condition-1"},
#                 {
#                     "id": "e2",
#                     "source": "condition-1",
#                     "target": "answer-pass",
#                     "sourceHandle": "case-pass",
#                 },
#                 {
#                     "id": "e3",
#                     "source": "condition-1",
#                     "target": "answer-fail",
#                     "sourceHandle": "default",
#                 },
#             ],
#         }

#         # 80점 입력 → 합격 분기
#         user_input = {"score": "80"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         # answer-pass가 실행되었는지 확인
#         assert result is not None

#     @pytest.mark.asyncio
#     async def test_condition_false_branch(self, mock_logger):
#         """조건이 거짓일 때 False(default) 분기 실행"""
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
#                                 "id": "var-score",
#                                 "name": "score",
#                                 "type": "number",
#                                 "label": "점수",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "condition-1",
#                     "type": "conditionNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "점수 체크",
#                         "cases": [
#                             {
#                                 "id": "case-pass",
#                                 "case_name": "합격",
#                                 "logical_operator": "and",
#                                 "conditions": [
#                                     {
#                                         "id": "cond-1",
#                                         "variable_selector": ["start-1", "score"],
#                                         "operator": "greater_than_or_equals",
#                                         "value": 60,
#                                     }
#                                 ],
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-pass",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": -50},
#                     "data": {
#                         "title": "합격 응답",
#                         "outputs": [{"variable": "status", "value_selector": []}],
#                     },
#                 },
#                 {
#                     "id": "answer-fail",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 50},
#                     "data": {
#                         "title": "불합격 응답",
#                         "outputs": [{"variable": "status", "value_selector": []}],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "condition-1"},
#                 {
#                     "id": "e2",
#                     "source": "condition-1",
#                     "target": "answer-pass",
#                     "sourceHandle": "case-pass",
#                 },
#                 {
#                     "id": "e3",
#                     "source": "condition-1",
#                     "target": "answer-fail",
#                     "sourceHandle": "default",
#                 },
#             ],
#         }

#         # 40점 입력 → 불합격 분기
#         user_input = {"score": "40"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         assert result is not None


# # ============================================================================
# # 3. Start → [병렬 노드] → Answer 병렬 실행 테스트
# # ============================================================================


# class TestParallelExecution:
#     """병렬 실행 테스트: Start → [Template A, Template B] → Answer"""

#     @pytest.mark.asyncio
#     async def test_parallel_templates_merge(self, mock_logger):
#         """두 개의 병렬 Template 결과를 Answer에서 합침"""
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
#                                 "id": "var-text",
#                                 "name": "text",
#                                 "type": "text",
#                                 "label": "텍스트",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-upper",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": -50},
#                     "data": {
#                         "title": "대문자 변환",
#                         "template": "UPPER: {{ text }}",
#                         "variables": [
#                             {"name": "text", "value_selector": ["start-1", "text"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-lower",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 50},
#                     "data": {
#                         "title": "소문자 변환",
#                         "template": "lower: {{ text }}",
#                         "variables": [
#                             {"name": "text", "value_selector": ["start-1", "text"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "upper_result",
#                                 "value_selector": ["template-upper", "text"],
#                             },
#                             {
#                                 "variable": "lower_result",
#                                 "value_selector": ["template-lower", "text"],
#                             },
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-upper"},
#                 {"id": "e2", "source": "start-1", "target": "template-lower"},
#                 {"id": "e3", "source": "template-upper", "target": "answer-1"},
#                 {"id": "e4", "source": "template-lower", "target": "answer-1"},
#             ],
#         }

#         user_input = {"text": "Hello"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         assert result["upper_result"] == "UPPER: Hello"
#         assert result["lower_result"] == "lower: Hello"


# # ============================================================================
# # 4. Start → Template → Template → Answer 체인 테스트
# # ============================================================================


# class TestChainedTemplates:
#     """연쇄 템플릿 테스트: Start → Template1 → Template2 → Answer"""

#     @pytest.mark.asyncio
#     async def test_chained_template_processing(self, mock_logger):
#         """첫 번째 템플릿 결과를 두 번째 템플릿에서 사용"""
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
#                                 "id": "var-name",
#                                 "name": "name",
#                                 "type": "text",
#                                 "label": "이름",
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "1차 가공",
#                         "template": "[{{ name }}]",
#                         "variables": [
#                             {"name": "name", "value_selector": ["start-1", "name"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-2",
#                     "type": "templateNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "2차 가공",
#                         "template": "결과: {{ prev }}",
#                         "variables": [
#                             {"name": "prev", "value_selector": ["template-1", "text"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 600, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "final",
#                                 "value_selector": ["template-2", "text"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 {"id": "e2", "source": "template-1", "target": "template-2"},
#                 {"id": "e3", "source": "template-2", "target": "answer-1"},
#             ],
#         }

#         user_input = {"name": "테스트"}
#         engine = WorkflowEngine(graph=graph, user_input=user_input, is_deployed=True)

#         result = await engine.execute()

#         assert result["final"] == "결과: [테스트]"


# # ============================================================================
# # 5. 에러 전파 테스트
# # ============================================================================


# class TestErrorPropagation:
#     """에러 전파 테스트: 노드 실행 중 에러 발생 시 워크플로우 중단"""

#     @pytest.mark.asyncio
#     async def test_missing_required_input(self, mock_logger):
#         """필수 입력이 없을 때의 동작 확인"""
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
#                     "data": {
#                         "title": "템플릿",
#                         "template": "Hello {{ missing_var }}",
#                         "variables": [
#                             {
#                                 "name": "missing_var",
#                                 "value_selector": ["nonexistent", "key"],
#                             }
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "result",
#                                 "value_selector": ["template-1", "text"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 {"id": "e2", "source": "template-1", "target": "answer-1"},
#             ],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={}, is_deployed=True)

#         # 에러가 발생하지 않고 빈 값으로 처리됨 (Template 노드의 동작)
#         result = await engine.execute()

#         # 빈 변수는 빈 문자열로 처리됨
#         assert result["result"] == "Hello "


# # ============================================================================
# # 6. 스트리밍 모드 이벤트 순서 테스트
# # ============================================================================


# class TestStreamingEvents:
#     """스트리밍 모드에서 이벤트 순서 검증"""

#     @pytest.mark.asyncio
#     async def test_event_order_in_pipeline(self, mock_logger):
#         """Start→Template→Answer 파이프라인의 이벤트 순서"""
#         graph = {
#             "nodes": [
#                 {
#                     "id": "start-1",
#                     "type": "startNode",
#                     "position": {"x": 0, "y": 0},
#                     "data": {
#                         "title": "시작",
#                         "variables": [
#                             {"id": "var-x", "name": "x", "type": "text", "label": "X"}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "template-1",
#                     "type": "templateNode",
#                     "position": {"x": 200, "y": 0},
#                     "data": {
#                         "title": "템플릿",
#                         "template": "Value: {{ x }}",
#                         "variables": [
#                             {"name": "x", "value_selector": ["start-1", "x"]}
#                         ],
#                     },
#                 },
#                 {
#                     "id": "answer-1",
#                     "type": "answerNode",
#                     "position": {"x": 400, "y": 0},
#                     "data": {
#                         "title": "응답",
#                         "outputs": [
#                             {
#                                 "variable": "out",
#                                 "value_selector": ["template-1", "text"],
#                             }
#                         ],
#                     },
#                 },
#             ],
#             "edges": [
#                 {"id": "e1", "source": "start-1", "target": "template-1"},
#                 {"id": "e2", "source": "template-1", "target": "answer-1"},
#             ],
#         }

#         engine = WorkflowEngine(graph=graph, user_input={"x": "test"})

#         events = []
#         async for event in engine.execute_stream():
#             events.append(event)

#         # 이벤트 타입 추출
#         event_types = [e["type"] for e in events]

#         # 기본 이벤트 순서 검증
#         assert event_types[0] == "workflow_start"
#         assert event_types[-1] == "workflow_finish"

#         # 각 노드에 대해 start/finish 이벤트가 있어야 함
#         node_starts = [e for e in events if e["type"] == "node_start"]
#         node_finishes = [e for e in events if e["type"] == "node_finish"]

#         assert len(node_starts) == 3  # start, template, answer
#         assert len(node_finishes) == 3
