"""Mail 노드 패키지"""

from workflow.nodes.mail.entities import EmailProvider, MailNodeData, MailVariable
from workflow.nodes.mail.mail_node import MailNode

__all__ = ["MailNode", "MailNodeData", "EmailProvider", "MailVariable"]
