"""Mail 노드 - IMAP 기반 이메일 검색"""

import email
import imaplib
from datetime import datetime
from email.header import decode_header
from typing import Any, Dict, List, Optional

from jinja2 import Environment

from apps.workflow_engine.nodes.base.node import Node
from apps.workflow_engine.nodes.mail.entities import MailNodeData

_jinja_env = Environment(autoescape=False)


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다."""
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class MailNode(Node[MailNodeData]):
    """
    IMAP을 사용하여 이메일을 검색하는 노드입니다.
    IMAP을 지원하는 모든 이메일 서비스에서 작동합니다.
    """

    node_type = "mailNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        이메일 검색을 실행하고 결과를 반환합니다.
        """
        data = self.data

        # 변수 치환
        keyword = self._render_template(data.keyword or "", inputs)
        sender = self._render_template(data.sender or "", inputs)
        subject = self._render_template(data.subject or "", inputs)
        password = self._render_template(data.password, inputs)

        # IMAP 연결
        mail = self._connect_imap(password)

        try:
            # 폴더 선택
            mail.select(data.folder)

            # 검색 쿼리 구성
            search_query = self._build_search_query(keyword, sender, subject)

            # 검색 실행
            status, messages = mail.search(None, search_query)
            if status != "OK":
                raise RuntimeError(f"이메일 검색 실패: {status}")

            email_ids = messages[0].split()

            # 결과 제한 (기본값: 5)
            max_results = data.max_results if data.max_results is not None else 5
            email_ids = email_ids[-max_results:]

            # 각 이메일 가져오기 (최신 순)
            emails = []
            for email_id in reversed(email_ids):
                msg = self._fetch_email(mail, email_id)
                emails.append(msg)

            return {
                "emails": emails,
                "total_count": len(emails),
                "folder": data.folder,
            }

        finally:
            # 연결 종료
            try:
                mail.close()
            except:
                pass
            mail.logout()

    def _connect_imap(self, password: str) -> imaplib.IMAP4_SSL:
        """IMAP 서버에 연결합니다."""
        try:
            if self.data.use_ssl:
                mail = imaplib.IMAP4_SSL(self.data.imap_server, self.data.imap_port)
            else:
                mail = imaplib.IMAP4(self.data.imap_server, self.data.imap_port)

            mail.login(self.data.email, password)
            return mail

        except imaplib.IMAP4.error as e:
            raise RuntimeError(f"IMAP 로그인 실패: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"IMAP 연결 실패: {str(e)}")

    def _build_search_query(self, keyword: str, sender: str, subject: str) -> str:
        """IMAP 검색 쿼리를 구성합니다."""
        criteria = []

        if self.data.unread_only:
            criteria.append("UNSEEN")

        if keyword:
            criteria.append(f'TEXT "{keyword}"')

        if sender:
            criteria.append(f'FROM "{sender}"')

        if subject:
            criteria.append(f'SUBJECT "{subject}"')

        # 날짜 필터: start_date가 없으면 기본 7일 전으로 설정
        start_date = self.data.start_date
        if not start_date:
            # 7일 전 날짜 계산
            from datetime import timedelta

            seven_days_ago = datetime.now() - timedelta(days=7)
            start_date = seven_days_ago.strftime("%Y-%m-%d")

        if start_date:
            # IMAP 날짜 형식: DD-Mon-YYYY
            try:
                date_obj = datetime.strptime(start_date, "%Y-%m-%d")
                imap_date = date_obj.strftime("%d-%b-%Y")
                criteria.append(f"SINCE {imap_date}")
            except ValueError:
                raise ValueError(
                    f"잘못된 날짜 형식: {start_date}. YYYY-MM-DD 형식을 사용하세요."
                )

        if self.data.end_date:
            try:
                date_obj = datetime.strptime(self.data.end_date, "%Y-%m-%d")
                # BEFORE criteria excludes the date, so we add 1 day to include it
                from datetime import timedelta

                date_obj += timedelta(days=1)

                imap_date = date_obj.strftime("%d-%b-%Y")
                criteria.append(f"BEFORE {imap_date}")
            except ValueError:
                raise ValueError(
                    f"잘못된 날짜 형식: {self.data.end_date}. YYYY-MM-DD 형식을 사용하세요."
                )
                raise ValueError(
                    f"잘못된 날짜 형식: {self.data.before_date}. YYYY-MM-DD 형식을 사용하세요."
                )

        return " ".join(criteria) if criteria else "ALL"

    def _fetch_email(self, mail: imaplib.IMAP4_SSL, email_id: bytes) -> Dict[str, Any]:
        """이메일 상세 정보를 가져옵니다."""
        status, msg_data = mail.fetch(email_id, "(RFC822)")

        if status != "OK" or not msg_data or not msg_data[0]:
            return {
                "id": email_id.decode(),
                "error": "Failed to fetch email",
            }

        msg = email.message_from_bytes(msg_data[0][1])

        # 헤더 파싱
        subject = self._decode_header(msg.get("Subject", ""))
        from_ = self._decode_header(msg.get("From", ""))
        to = self._decode_header(msg.get("To", ""))
        date = msg.get("Date", "")

        # 본문 추출
        body_text = ""
        body_html = ""
        attachments = []

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition"))

                if "attachment" in content_disposition:
                    # 첨부파일
                    filename = part.get_filename()
                    if filename:
                        attachments.append(
                            {
                                "filename": self._decode_header(filename),
                                "content_type": content_type,
                                "size": len(part.get_payload(decode=True) or b""),
                            }
                        )
                elif content_type == "text/plain" and not body_text:
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_text = payload.decode("utf-8", errors="ignore")
                    except:
                        pass
                elif content_type == "text/html" and not body_html:
                    try:
                        payload = part.get_payload(decode=True)
                        if payload:
                            body_html = payload.decode("utf-8", errors="ignore")
                    except:
                        pass
        else:
            # 단일 파트 메시지
            try:
                payload = msg.get_payload(decode=True)
                if payload:
                    body_text = payload.decode("utf-8", errors="ignore")
            except:
                pass

        # Mark as read if requested
        if self.data.mark_as_read:
            try:
                mail.store(email_id, "+FLAGS", "\\Seen")
            except:
                pass

        return {
            "id": email_id.decode(),
            "subject": subject,
            "from": from_,
            "to": to,
            "date": date,
            "body_text": body_text[:1000] if body_text else "",  # 처음 1000자
            "body_html": body_html[:1000] if body_html else "",
            "snippet": body_text[:200] if body_text else "",  # 미리보기
            "has_attachments": len(attachments) > 0,
            "attachments": attachments,
        }

    def _decode_header(self, header: str) -> str:
        """이메일 헤더를 디코딩합니다."""
        if not header:
            return ""

        try:
            decoded_parts = decode_header(header)
            result = []
            for content, encoding in decoded_parts:
                if isinstance(content, bytes):
                    result.append(content.decode(encoding or "utf-8", errors="ignore"))
                else:
                    result.append(str(content))
            return "".join(result)
        except:
            return str(header)

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
