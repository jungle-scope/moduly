"""GitHub 노드 테스트"""

from unittest.mock import MagicMock, patch

import pytest

from apps.workflow_engine.workflow.nodes.github.entities import GithubAction, GithubNodeData, GithubVariable
from apps.workflow_engine.workflow.nodes.github.github_node import GithubNode


@pytest.fixture
def mock_github_client():
    """GitHub 클라이언트 Mock"""
    with patch("apps.workflow_engine.workflow.nodes.github.github_node.Github") as mock:
        yield mock


# ============================================================================
# 1. Get PR Diff 정상 동작
# ============================================================================


def test_get_pr_success(mock_github_client):
    """Get PR Diff 액션이 정상적으로 PR 정보를 조회한다"""
    # Mock 설정
    mock_file = MagicMock()
    mock_file.filename = "src/app.py"
    mock_file.status = "modified"
    mock_file.additions = 10
    mock_file.deletions = 5
    mock_file.changes = 15
    mock_file.patch = "@@ -1,5 +1,10 @@\n+new code"

    mock_repo = MagicMock()
    mock_pr = MagicMock()
    mock_pr.title = "Add new feature"
    mock_pr.body = "This PR adds a new feature"
    mock_pr.state = "open"
    mock_pr.number = 123
    mock_pr.diff_url = "https://github.com/owner/repo/pull/123.diff"
    mock_pr.get_files.return_value = [mock_file]

    mock_repo.get_pull.return_value = mock_pr
    mock_github_client.return_value.get_repo.return_value = mock_repo

    # 노드 생성 및 실행
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number=123,
    )
    node = GithubNode(id="github-1", data=node_data)

    result = node._run(inputs={})

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


def test_comment_pr_success(mock_github_client):
    """Comment PR 액션이 정상적으로 댓글을 작성한다"""
    # Mock 설정
    mock_repo = MagicMock()
    mock_pr = MagicMock()
    mock_comment = MagicMock()
    mock_comment.id = 456789
    mock_comment.html_url = "https://github.com/owner/repo/pull/123#issuecomment-456789"
    mock_comment.body = "Great work!"

    mock_pr.create_issue_comment.return_value = mock_comment
    mock_repo.get_pull.return_value = mock_pr
    mock_github_client.return_value.get_repo.return_value = mock_repo

    # 노드 생성 및 실행
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.COMMENT_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number=123,
        comment_body="Great work!",
    )
    node = GithubNode(id="github-1", data=node_data)

    result = node._run(inputs={})

    # 검증
    assert result["comment_id"] == 456789
    assert (
        result["comment_url"]
        == "https://github.com/owner/repo/pull/123#issuecomment-456789"
    )
    assert result["comment_body"] == "Great work!"
    mock_pr.create_issue_comment.assert_called_once_with("Great work!")


# ============================================================================
# 3. 변수 치환 (Jinja2)
# ============================================================================


def test_variable_substitution_simple(mock_github_client):
    """Jinja2 변수 치환이 정상 동작한다"""
    mock_repo = MagicMock()
    mock_pr = MagicMock()
    mock_comment = MagicMock()
    mock_comment.id = 1
    mock_comment.html_url = "https://github.com/test"
    mock_comment.body = "Review result: LGTM!"

    mock_pr.create_issue_comment.return_value = mock_comment
    mock_repo.get_pull.return_value = mock_pr
    mock_github_client.return_value.get_repo.return_value = mock_repo

    # referenced_variables 설정
    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.COMMENT_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number=123,
        comment_body="Review result: {{ review }}",
        referenced_variables=[
            GithubVariable(name="review", value_selector=["llm-1", "text"])
        ],
    )
    node = GithubNode(id="github-1", data=node_data)

    # 입력 데이터 (이전 노드 결과)
    inputs = {"llm-1": {"text": "LGTM!"}}

    node._run(inputs=inputs)

    # 검증: 변수가 치환되어 댓글 작성됨
    mock_pr.create_issue_comment.assert_called_once_with("Review result: LGTM!")


# ============================================================================
# 4. 에러 처리 - 잘못된 토큰
# ============================================================================


def test_invalid_token_error(mock_github_client):
    """잘못된 토큰은 RuntimeError를 발생시킨다"""
    from github.GithubException import GithubException

    # 401 Unauthorized 에러 Mock
    mock_github_client.return_value.get_repo.side_effect = GithubException(
        status=401, data={"message": "Bad credentials"}
    )

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="invalid_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number=123,
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류.*401.*Bad credentials"):
        node._run(inputs={})


# ============================================================================
# 5. 에러 처리 - 잘못된 PR 번호
# ============================================================================


def test_invalid_pr_number_error(mock_github_client):
    """존재하지 않는 PR 번호는 RuntimeError를 발생시킨다"""
    from github.GithubException import GithubException

    mock_repo = MagicMock()
    mock_repo.get_pull.side_effect = GithubException(
        status=404, data={"message": "Not Found"}
    )
    mock_github_client.return_value.get_repo.return_value = mock_repo

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number=999999,
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류.*404.*Not Found"):
        node._run(inputs={})


def test_invalid_repo_error(mock_github_client):
    """존재하지 않는 저장소는 RuntimeError를 발생시킨다"""
    from github.GithubException import GithubException

    mock_github_client.return_value.get_repo.side_effect = GithubException(
        status=404, data={"message": "Not Found"}
    )

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="nonexistent",
        repo_name="repo",
        pr_number=123,
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류.*404"):
        node._run(inputs={})
