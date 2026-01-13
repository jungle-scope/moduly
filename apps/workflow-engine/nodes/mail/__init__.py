"""Mail 노드 패키지"""

from apps.workflow_engine.nodes.mail.entities import EmailProvider, MailNodeData, MailVariable
from apps.workflow_engine.nodes.mail.mail_node import MailNode

__all__ = ["MailNode", "MailNodeData", "EmailProvider", "MailVariable"]
