"""GitHub 노드 테스트 [GEVENT] Sync 버전

GithubNode가 _run 내에서 `import requests`로 로컬 임포트하므로
requests.get/requests.post를 직접 패치합니다.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

from apps.workflow_engine.workflow.nodes.github.entities import (
    GithubAction,
    GithubNodeData,
    GithubVariable,
)
from apps.workflow_engine.workflow.nodes.github.github_node import GithubNode

# ============================================================================
# 1. Get PR Diff 정상 동작
# ============================================================================


@patch("requests.get")
def test_get_pr_success(mock_get):
    """Get PR Diff 액션이 정상적으로 PR 정보를 조회한다"""
    # PR 정보 응답
    pr_response = MagicMock()
    pr_response.json.return_value = {
        "title": "Add new feature",
        "body": "This PR adds a new feature",
        "state": "open",
        "number": 123,
        "diff_url": "https://github.com/owner/repo/pull/123.diff",
    }

    # 파일 목록 응답
    files_response = MagicMock()
    files_response.json.return_value = [
        {
            "filename": "src/app.py",
            "status": "modified",
            "additions": 10,
            "deletions": 5,
            "changes": 15,
            "patch": "@@ -1,5 +1,10 @@\n+new code",
        }
    ]

    mock_get.side_effect = [pr_response, files_response]

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

    # [GEVENT] sync 호출
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

    # API 호출 확인
    assert mock_get.call_count == 2


# ============================================================================
# 2. Comment PR 정상 동작
# ============================================================================


@patch("requests.post")
def test_comment_pr_success(mock_post):
    """Comment PR 액션이 정상적으로 댓글을 작성한다"""
    # 댓글 작성 응답
    comment_response = MagicMock()
    comment_response.json.return_value = {
        "id": 456789,
        "html_url": "https://github.com/owner/repo/pull/123#issuecomment-456789",
        "body": "Great work!",
    }

    mock_post.return_value = comment_response

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

    # [GEVENT] sync 호출
    result = node._run(inputs={})

    # 검증
    assert result["comment_id"] == 456789
    assert (
        result["comment_url"]
        == "https://github.com/owner/repo/pull/123#issuecomment-456789"
    )
    assert result["comment_body"] == "Great work!"

    # 호출 확인
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "/issues/123/comments" in call_args[0][0]
    assert call_args[1]["json"]["body"] == "Great work!"


# ============================================================================
# 3. 변수 치환 (Jinja2)
# ============================================================================


@patch("requests.post")
def test_variable_substitution_simple(mock_post):
    """Jinja2 변수 치환이 정상 동작한다"""
    # Mock 설정
    comment_response = MagicMock()
    comment_response.json.return_value = {
        "id": 1,
        "html_url": "https://github.com/test",
        "body": "Review result: LGTM!",
    }
    mock_post.return_value = comment_response

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

    # [GEVENT] sync 호출
    node._run(inputs=inputs)

    # 검증: 변수가 치환되어 댓글 작성됨
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert call_args[1]["json"]["body"] == "Review result: LGTM!"


# ============================================================================
# 4. 에러 처리
# ============================================================================


@patch("requests.get")
def test_invalid_token_error(mock_get):
    """API 호출 에러(401)는 RuntimeError를 발생시킨다"""
    # Mock 설정 - 인증 실패
    error_response = MagicMock()
    error_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
        "401 Unauthorized"
    )
    mock_get.return_value = error_response

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="invalid_token",
        repo_owner="facebook",
        repo_name="react",
        pr_number="123",
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류"):
        # [GEVENT] sync 호출
        node._run(inputs={})


@patch("requests.get")
def test_github_not_found_error(mock_get):
    """리포지토리/PR이 없으면 RuntimeError를 발생시킨다"""
    # Mock 설정 - Not Found
    error_response = MagicMock()
    error_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
        "404 Not Found"
    )
    mock_get.return_value = error_response

    node_data = GithubNodeData(
        title="GitHub",
        action=GithubAction.GET_PR,
        api_token="ghp_test_token",
        repo_owner="nonexistent",
        repo_name="repo",
        pr_number="123",
    )
    node = GithubNode(id="github-1", data=node_data)

    with pytest.raises(RuntimeError, match="GitHub API 오류"):
        # [GEVENT] sync 호출
        node._run(inputs={})
