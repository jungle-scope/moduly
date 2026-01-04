"""GitHub API 연동 노드"""

import re
from typing import Any, Dict

from github import Github
from github.GithubException import GithubException

from workflow.nodes.base.node import Node
from workflow.nodes.github.entities import GithubNodeData


class GithubNode(Node[GithubNodeData]):
    """
    GitHub API와 상호작용하는 노드입니다.
    PR 코드 조회, 댓글 작성 등의 기능을 제공합니다.
    """

    node_type = "githubNode"

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        GitHub API 요청을 실행하고 결과를 반환합니다.
        """
        data = self.data

        # 변수 치환
        token = self._substitute_variables(data.api_token, inputs)
        repo_owner = self._substitute_variables(data.repo_owner, inputs)
        repo_name = self._substitute_variables(data.repo_name, inputs)
        pr_number_str = self._substitute_variables(str(data.pr_number), inputs)

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
            files = pull_request.get_files()
            diff_content = []

            for file in files:
                diff_content.append(
                    {
                        "filename": file.filename,
                        "status": file.status,
                        "additions": file.additions,
                        "deletions": file.deletions,
                        "patch": file.patch if file.patch else "",
                    }
                )

            return {
                "pr_title": pull_request.title,
                "pr_body": pull_request.body or "",
                "pr_state": pull_request.state,
                "files": diff_content,
                "diff_url": pull_request.diff_url,
            }

        elif action == "comment_pr":
            # PR에 댓글 달기
            comment_body = self._substitute_variables(data.comment_body or "", inputs)

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

    def _substitute_variables(self, text: str, inputs: Dict[str, Any]) -> str:
        """
        텍스트 내의 {{NodeId.variable}} 패턴을 찾아 실제 값으로 치환합니다.

        Args:
            text: 치환할 원본 문자열
            inputs: 현재까지의 실행 결과(컨텍스트)

        Returns:
            치환된 문자열
        """
        if not text:
            return text

        pattern = re.compile(r"\{\{\s*([\w\.\-]+)\s*\}\}")

        def replace_match(match):
            variable_path = match.group(1).strip()

            if "." in variable_path:
                node_id, var_name = variable_path.split(".", 1)
                node_data = inputs.get(node_id)
                if isinstance(node_data, dict) and var_name in node_data:
                    return str(node_data[var_name])

            return match.group(0)

        return pattern.sub(replace_match, text)
