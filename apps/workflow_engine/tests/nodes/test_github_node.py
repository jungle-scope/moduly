"""GitHub 노드 테스트"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import gidgethub

from apps.workflow_engine.workflow.nodes.github.entities import (
    GithubAction,
    GithubNodeData,
    GithubVariable,
)
from apps.workflow_engine.workflow.nodes.github.github_node import GithubNode


@pytest.fixture
def mock_gh_api():
    """gidgethub.httpx.GitHubAPI Mock"""
    with patch("apps.workflow_engine.workflow.nodes.github.github_node.gidgethub.httpx.GitHubAPI") as mock:
        yield mock


@pytest.fixture
def mock_httpx_client():
    """httpx.AsyncClient Mock"""
    with patch("apps.workflow_engine.workflow.nodes.github.github_node.httpx.AsyncClient") as mock:
        client_instance = AsyncMock()
        client_instance.__aenter__.return_value = client_instance
        client_instance.__aexit__.return_value = None
        mock.return_value = client_instance
        yield mock


# ============================================================================
# 1. Get PR Diff 정상 동작
# ============================================================================


@pytest.mark.asyncio
async def test_get_pr_success(mock_gh_api, mock_httpx_client):
    """Get PR Diff 액션이 정상적으로 PR 정보를 조회한다"""
    # Mock 설정
    gh_instance = mock_gh_api.return_value
    
    # getitem 결과 (PR 정보) - AsyncMock으로 설정
    gh_instance.getitem = AsyncMock(return_value={
        "title": "Add new feature",
        "body": "This PR adds a new feature",
        "state": "open",
        "number": 123,
        "diff_url": "https://github.com/owner/repo/pull/123.diff",
    })

    # getiter 결과 (파일 목록) - Async Iterator Mock
    async def async_gen_files(url):
        yield {
            "filename": "src/app.py",
            "status": "modified",
            "additions": 10,
            "deletions": 5,
            "changes": 15,
            "patch": "@@ -1,5 +1,10 @@\n+new code"
        }

    gh_instance.getiter.side_effect = async_gen_files

    # 노드 생성 및 실행
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number="123",
    )
    node = GithubNode(id="github-1", data=node_data)

    result = await node._run(inputs={})

    # 검증
    assert result["pr_title"] == "Add new feature"
    assert result["pr_body"] == "This PR adds a new feature"
    assert result["pr_state"] == "open"
    assert result["pr_number"] == 123
    assert result["files_count"] == 1
    assert len(result["files"]) == 1
    assert result["files"][0]["filename"] == "src/app.py"
    assert result["files"][0]["additions"] == 10
    assert result["files"][0]["deletions"] == 5
    assert result["diff_url"] == "https://github.com/owner/repo/pull/123.diff"


# ============================================================================
# 2. Comment PR 정상 동작
# ============================================================================


@pytest.mark.asyncio
async def test_comment_pr_success(mock_gh_api, mock_httpx_client):
    """Comment PR 액션이 정상적으로 댓글을 작성한다"""
    # Mock 설정
    gh_instance = mock_gh_api.return_value
    
    # post 결과 (댓글 작성 응답) - AsyncMock
    gh_instance.post = AsyncMock(return_value={
        "id": 456789,
        "html_url": "https://github.com/owner/repo/pull/123#issuecomment-456789",
        "body": "Great work!"
    })

    # 노드 생성 및 실행
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.COMMENT_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number="123",
        comment_body="Great work!",
    )
    node = GithubNode(id="github-1", data=node_data)

    result = await node._run(inputs={})

    # 검증
    assert result["comment_id"] == 456789
    assert result["comment_url"] == "https://github.com/owner/repo/pull/123#issuecomment-456789"
    assert result["comment_body"] == "Great work!"
    
    # 호출 확인
    gh_instance.post.assert_called_once()
    call_args = gh_instance.post.call_args
    assert call_args[0][0] == "/repos/facebook/react/issues/123/comments"
    assert call_args[1]["data"]["body"] == "Great work!"


# ============================================================================
# 3. 변수 치환 (Jinja2)
# ============================================================================


@pytest.mark.asyncio
async def test_variable_substitution_simple(mock_gh_api, mock_httpx_client):
    """Jinja2 변수 치환이 정상 동작한다"""
    gh_instance = mock_gh_api.return_value

    gh_instance.post = AsyncMock(return_value={
        "id": 1,
        "html_url": "https://github.com/test",
        "body": "Review result: LGTM!"
    })

    # referenced_variables 설정
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.COMMENT_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number="123",
        comment_body="Review result: {{ review }}",
        referenced_variables=[
            GithubVariable(name="review", value_selector=["llm-1", "text"])
        ],
    )
    node = GithubNode(id="github-1", data=node_data)

    # 입력 데이터 (이전 노드 결과)
    inputs = {"llm-1": {"text": "LGTM!"}}

    await node._run(inputs=inputs)

    # 검증: 변수가 치환되어 댓글 작성됨
    gh_instance.post.assert_called_once()
    assert gh_instance.post.call_args[1]["data"]["body"] == "Review result: LGTM!"


# ============================================================================
# 4. 에러 처리
# ============================================================================


@pytest.mark.asyncio
async def test_invalid_token_error(mock_gh_api, mock_httpx_client):
    """API 호출 에러(BadRequest)는 RuntimeError를 발생시킨다"""
    gh_instance = mock_gh_api.return_value
    
    # BadRequest 에러 Mock
    from gidgethub import BadRequest
    mock_status = MagicMock()
    mock_status.phrase = "Bad Request"
    gh_instance.getitem = AsyncMock(side_effect=BadRequest(mock_status, "Bad credentials"))

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="invalid_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number="123",
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류.*Bad credentials"):
        await node._run(inputs={})


@pytest.mark.asyncio
async def test_github_exception_error(mock_gh_api, mock_httpx_client):
    """기타 GitHubException은 RuntimeError를 발생시킨다"""
    gh_instance = mock_gh_api.return_value
    
    # GitHubException 에러 Mock
    from gidgethub import GitHubException
    mock_status = MagicMock()
    mock_status.phrase = "Not Found"
    gh_instance.getitem = AsyncMock(side_effect=GitHubException(mock_status, "Not Found"))

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="nonexistent",
        repo_name="repo",
        pr_number="123",
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류.*Not Found"):
        await node._run(inputs={})
