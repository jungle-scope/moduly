"""Mail 노드 테스트"""

from unittest.mock import MagicMock, patch

import pytest

from apps.workflow_engine.workflow.nodes.mail.entities import EmailProvider, MailNodeData, MailVariable
from apps.workflow_engine.workflow.nodes.mail.mail_node import MailNode


@pytest.fixture
def mock_imap():
    """IMAP 클라이언트 Mock"""
    with patch("apps.workflow_engine.workflow.nodes.mail.mail_node.imaplib.IMAP4_SSL") as mock:
        yield mock


# ============================================================================
# 1. 기본 검색 성공 테스트
# ============================================================================


def test_mail_search_success(mock_imap):
    """메일 검색이 정상적으로 동작한다"""
    # Mock IMAP 설정
    mock_mail = MagicMock()
    mock_mail.select.return_value = ("OK", [b"INBOX"])
    mock_mail.search.return_value = ("OK", [b"1 2 3"])

    # Mock 이메일 데이터
    mock_email_data = b"""From: sender@example.com
To: recipient@example.com
Subject: Test Email
Date: Mon, 05 Jan 2026 10:00:00 +0000

This is a test email body.
"""
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822 {123})", mock_email_data)])
    mock_imap.return_value = mock_mail

    # 노드 생성 및 실행
    node_data = MailNodeData(
        title="Mail Search",
        provider=EmailProvider.GMAIL,
        email="test@gmail.com",
        password="app_password",
        imap_server="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        keyword="test",
        folder="INBOX",
        max_results=10,
        referenced_variables=[],
    )

    node = MailNode(id="mail-test", data=node_data)
    result = node._run(inputs={})

    # 검증
    assert result["total_count"] == 3
    assert result["folder"] == "INBOX"
    assert len(result["emails"]) == 3
    assert result["emails"][0]["subject"] == "Test Email"
    assert result["emails"][0]["from"] == "sender@example.com"


# ============================================================================
# 2. 변수 치환 테스트
# ============================================================================


def test_mail_variable_substitution(mock_imap):
    """referenced_variables를 사용한 변수 치환이 정상 동작한다"""
    # Mock IMAP 설정
    mock_mail = MagicMock()
    mock_mail.select.return_value = ("OK", [b"INBOX"])
    mock_mail.search.return_value = ("OK", [b"1"])

    mock_email_data = b"""From: sender@example.com
To: recipient@example.com
Subject: PR #123
Date: Mon, 05 Jan 2026 10:00:00 +0000

Pull request merged.
"""
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822 {123})", mock_email_data)])
    mock_imap.return_value = mock_mail

    # 변수가 포함된 노드 데이터
    node_data = MailNodeData(
        title="Mail Search",
        provider=EmailProvider.GMAIL,
        email="test@gmail.com",
        password="app_password",
        imap_server="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        keyword="{{pr_number}}",  # Jinja2 템플릿
        folder="INBOX",
        max_results=10,
        referenced_variables=[
            MailVariable(name="pr_number", value_selector=["start-123", "pr_id"])
        ],
    )

    node = MailNode(id="mail-test", data=node_data)

    # 입력 데이터 (upstream 노드 결과)
    inputs = {"start-123": {"pr_id": "PR #123"}}

    result = node._run(inputs=inputs)

    # 검증: keyword가 "PR #123"로 치환되어 검색됨
    assert result["total_count"] == 1
    assert "PR #123" in result["emails"][0]["subject"]


# ============================================================================
# 3. 인증 실패 테스트
# ============================================================================


def test_mail_authentication_failure(mock_imap):
    """잘못된 인증 정보로 에러가 발생한다"""
    # Mock IMAP 인증 실패
    mock_imap.return_value.login.side_effect = Exception("Authentication failed")

    node_data = MailNodeData(
        title="Mail Search",
        provider=EmailProvider.GMAIL,
        email="test@gmail.com",
        password="wrong_password",
        imap_server="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        keyword="test",
        folder="INBOX",
        max_results=10,
        referenced_variables=[],
    )

    node = MailNode(id="mail-test", data=node_data)

    # 에러 발생 확인
    with pytest.raises(RuntimeError, match="IMAP 연결 실패"):
        node._run(inputs={})


# ============================================================================
# 4. 빈 검색 결과 테스트
# ============================================================================


def test_mail_empty_results(mock_imap):
    """검색 조건에 맞는 메일이 없을 때 빈 배열을 반환한다"""
    # Mock IMAP 설정 - 검색 결과 없음
    mock_mail = MagicMock()
    mock_mail.select.return_value = ("OK", [b"INBOX"])
    mock_mail.search.return_value = ("OK", [b""])  # 빈 결과
    mock_imap.return_value = mock_mail

    node_data = MailNodeData(
        title="Mail Search",
        provider=EmailProvider.GMAIL,
        email="test@gmail.com",
        password="app_password",
        imap_server="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        keyword="nonexistent_keyword_12345",
        folder="INBOX",
        max_results=10,
        referenced_variables=[],
    )

    node = MailNode(id="mail-test", data=node_data)
    result = node._run(inputs={})

    # 검증
    assert result["total_count"] == 0
    assert result["emails"] == []
    assert result["folder"] == "INBOX"
