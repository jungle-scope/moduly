"""GitHub 노드 데이터 스키마"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class GithubAction(str, Enum):
    """GitHub 노드 액션 타입"""

    GET_PR = "get_pr"
    COMMENT_PR = "comment_pr"


class GithubVariable(BaseModel):
    """GitHub 노드 변수 매핑 (LLM 노드와 동일한 구조)"""

    name: str = Field("", description="변수 이름")
    value_selector: List[str] = Field(
        default_factory=list, description="값 선택자 [node_id, output_key]"
    )


class GithubNodeData(BaseNodeData):
    """
    GitHub Node 설정 데이터
    """

    action: GithubAction = Field(
        GithubAction.GET_PR, description="수행할 액션 (get_pr, comment_pr)"
    )
    api_token: str = Field(..., description="GitHub Personal Access Token")
    repo_owner: str = Field(..., description="저장소 소유자 (예: facebook)")
    repo_name: str = Field(..., description="저장소 이름 (예: react)")
    pr_number: int = Field(..., description="Pull Request 번호")
    comment_body: Optional[str] = Field(
        None, description="댓글 내용 (comment_pr 액션일 때 사용)"
    )
    referenced_variables: List[GithubVariable] = Field(
        default_factory=list, description="참조된 변수 목록"
    )
