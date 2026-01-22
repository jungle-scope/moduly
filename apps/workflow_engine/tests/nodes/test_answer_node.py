import pytest
from apps.workflow_engine.workflow.nodes.answer.answer_node import AnswerNode
from apps.workflow_engine.workflow.nodes.answer.entities import AnswerNodeData, AnswerNodeOutput


@pytest.mark.asyncio
async def test_answer_node_execution():
    # 1. Answer Node 설정 (outputs)
    node_data = AnswerNodeData(
        title="결과 노드",
        outputs=[
            AnswerNodeOutput(
                variable="user_input", value_selector=["start_node", "query"]
            ),
            AnswerNodeOutput(
                variable="ai_response", value_selector=["llm_node", "text"]
            ),
        ],
    )
    node = AnswerNode(id="answer_node", data=node_data)

    # 2. 실행 입력 (inputs) - 상위 노드들의 결과가 포함됨
    inputs = {
        "start_node": {"query": "Hello AI"},
        "llm_node": {"text": "Hi there!"},
        "unrelated_node": {"data": 123},
    }

    # 3. 노드 실행
    result = await node.execute(inputs)

    # 4. 결과 검증
    assert result["user_input"] == "Hello AI"
    assert result["ai_response"] == "Hi there!"
    assert "unrelated_node" not in result


@pytest.mark.asyncio
async def test_answer_node_missing_input():
    # 연결된 노드가 실행되지 않았거나 결과가 없는 경우
    node_data = AnswerNodeData(
        title="결과 노드",
        outputs=[
            AnswerNodeOutput(
                variable="missing_var", value_selector=["missing_node", "key"]
            ),
        ],
    )
    node = AnswerNode(id="answer_node", data=node_data)

    inputs = {"start_node": {"query": "Hello"}}

    result = await node.execute(inputs)

    # 데이터가 없으면 None으로 처리 (또는 에러 정책에 따라 다름)
    assert result["missing_var"] is None
