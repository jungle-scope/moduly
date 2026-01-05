"""Mail 노드 데이터 스키마"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class EmailProvider(str, Enum):
    """이메일 서비스 제공자"""

    GMAIL = "gmail"
    NAVER = "naver"
    DAUM = "daum"
    OUTLOOK = "outlook"
    CUSTOM = "custom"


class MailVariable(BaseModel):
    """Mail 노드 변수 매핑"""

    name: str = Field("", description="변수 이름")
    value_selector: List[str] = Field(
        default_factory=list, description="값 선택자 [node_id, output_key]"
    )


class MailNodeData(BaseNodeData):
    """Mail Node 설정 데이터"""

    # Account
    email: str = Field(..., description="이메일 주소")
    password: str = Field(..., description="비밀번호 또는 앱 비밀번호")

    # Server (프리셋으로 자동 설정)
    provider: EmailProvider = Field(
        EmailProvider.GMAIL, description="이메일 서비스 제공자"
    )
    imap_server: str = Field("imap.gmail.com", description="IMAP 서버 주소")
    imap_port: int = Field(993, description="IMAP 포트")
    use_ssl: bool = Field(True, description="SSL 사용 여부")

    # Search Criteria
    keyword: Optional[str] = Field(None, description="검색 키워드")
    sender: Optional[str] = Field(None, description="발신자 필터")
    subject: Optional[str] = Field(None, description="제목 필터")
    start_date: Optional[str] = Field(None, description="시작일 (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="종료일 (YYYY-MM-DD)")

    # Options
    folder: str = Field("INBOX", description="검색할 폴더")
    max_results: Optional[int] = Field(
        None, description="최대 결과 개수 (기본값: 5)", ge=1, le=100
    )
    unread_only: bool = Field(False, description="읽지 않은 메일만")
    mark_as_read: bool = Field(False, description="검색 후 읽음 표시")

    # Variables
    referenced_variables: List[MailVariable] = Field(
        default_factory=list, description="참조된 변수 목록"
    )
