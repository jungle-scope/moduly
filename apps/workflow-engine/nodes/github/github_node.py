"""GitHub API 연동 노드"""

from typing import Any, Dict, List, Optional

from github import Github
from github.GithubException import GithubException
from jinja2 import Environment

from apps.workflow_engine.nodes.base.node import Node
from apps.workflow_engine.nodes.github.entities import GithubNodeData

_jinja_env = Environment(autoescape=False)


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class GithubNode(Node[GithubNodeData]):
    """
    GitHub API와 상호작용하는 노드입니다.
    PR 코드 조회, 댓글 작성 등의 기능을 제공합니다.
    """

    node_type = "githubNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        GitHub API 요청을 실행하고 결과를 반환합니다.
        """
        data = self.data

        # 변수 치환 (referenced_variables 기반)
        token = self._render_template(data.api_token, inputs)
        repo_owner = self._render_template(data.repo_owner, inputs)
        repo_name = self._render_template(data.repo_name, inputs)
        pr_number_str = self._render_template(str(data.pr_number), inputs)

        try:
            pr_number = int(pr_number_str)
        except ValueError:
            raise ValueError(f"PR 번호가 유효하지 않습니다: {pr_number_str}")

        # GitHub 클라이언트 초기화
        try:
            github_client = Github(token)
            repo = github_client.get_repo(f"{repo_owner}/{repo_name}")
            pull_request = repo.get_pull(pr_number)
        except GithubException as e:
            raise RuntimeError(
                f"GitHub API 오류 (status: {e.status}): {e.data.get('message', str(e))}"
            )

        # Action에 따라 분기
        action = data.action

        if action == "get_pr":
            # PR Diff 가져오기
            files = list(pull_request.get_files())  # PaginatedList를 list로 변환
            diff_content = []

            for file in files:
                diff_content.append(
                    {
                        "filename": file.filename,
                        "status": file.status,
                        "additions": file.additions,
                        "deletions": file.deletions,
                        "changes": file.changes,
                        "patch": file.patch if file.patch else "",
                    }
                )

            return {
                "pr_title": pull_request.title,
                "pr_body": pull_request.body or "",
                "pr_state": pull_request.state,
                "pr_number": pull_request.number,
                "files_count": len(diff_content),
                "files": diff_content,
                "diff_url": pull_request.diff_url,
            }

        elif action == "comment_pr":
            # PR에 댓글 달기
            comment_body = self._render_template(data.comment_body or "", inputs)

            if not comment_body:
                raise ValueError("댓글 내용이 비어있습니다.")

            comment = pull_request.create_issue_comment(comment_body)

            return {
                "comment_id": comment.id,
                "comment_url": comment.html_url,
                "comment_body": comment.body,
            }

        else:
            raise ValueError(f"지원하지 않는 액션입니다: {action}")

    def _render_template(self, template: Optional[str], inputs: Dict[str, Any]) -> str:
        """
        템플릿을 Jinja2로 렌더링합니다.
        referenced_variables의 value_selector를 사용하여 이전 노드의 output에서 값을 추출합니다.
        """
        if not template:
            return ""

        context: Dict[str, Any] = {}

        # referenced_variables에서 각 변수의 값을 추출
        for variable in self.data.referenced_variables:
            var_name = variable.name
            selector = variable.value_selector

            # 필수값 체크
            if not var_name or not selector or len(selector) < 1:
                context[var_name] = ""
                continue

            target_node_id = selector[0]

            # 입력 데이터에서 해당 노드의 결과 찾기
            source_data = inputs.get(target_node_id)

            if source_data is None:
                context[var_name] = ""
                continue

            # 값 추출 (selector가 2개 이상일 경우 중첩된 값 탐색)
            if len(selector) > 1:
                value = _get_nested_value(source_data, selector[1:])
                context[var_name] = value if value is not None else ""
            else:
                # selector가 노드 ID만 있는 경우
                context[var_name] = source_data

        # Jinja2 템플릿 렌더링
        try:
            return _jinja_env.from_string(template).render(**context)
        except Exception as e:
            raise ValueError(f"템플릿 렌더링 실패: {e}")
