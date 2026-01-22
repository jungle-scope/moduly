from __future__ import annotations

import re
from typing import Tuple

# 외부 문서/로그는 신뢰할 수 없으므로 간단한 규칙 기반으로 지시문 흔적을 제거합니다.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

_SUSPICIOUS_LINE_PATTERNS = [
    re.compile(
        r"(?i)\b(ignore|disregard|bypass|override|forget)\b.{0,80}\b"
        r"(instruction|instructions|system|developer|assistant|previous|above|policy|rule|rules)\b"
    ),
    re.compile(
        r"(?i)\b(system prompt|developer message|assistant message|system message|prompt injection|jailbreak)\b"
    ),
    re.compile(r"(?i)\b(do not follow|don't follow|stop following|ignore the above|ignore previous)\b"),
    re.compile(r"(?i)\bact as\b.{0,40}\b(system|developer|assistant)\b"),
    re.compile(r"(?i)\bBEGIN (SYSTEM|DEVELOPER|INSTRUCTIONS|PROMPT)\b"),
    re.compile(r"(?i)```\s*(system|developer|assistant)\b"),
    re.compile(r"(?i)\brole\s*:\s*(system|developer|assistant)\b"),
    re.compile(r"(?i)\b(tool|function)\s*(call|calls|calling|execution|invoke)\b"),
    re.compile(r"(?i)^\s*(system|developer|assistant|user)\s*:"),
    # 한국어 패턴
    re.compile(r"(시스템|개발자|어시스턴트)\s*프롬프트"),
    re.compile(r"(이전|위의)\s*지시.*(무시|무시하고)"),
    re.compile(r"(프롬프트\s*인젝션|탈옥)"),
    re.compile(r"역할\s*:\s*(시스템|개발자|어시스턴트)"),
]

_REDACTED_LINE = "[REDACTED: possible prompt injection]"


def _looks_like_instruction(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    return any(pattern.search(stripped) for pattern in _SUSPICIOUS_LINE_PATTERNS)


def sanitize_untrusted_text(text: str, max_chars: int = 0) -> Tuple[str, int]:
    """
    신뢰할 수 없는 텍스트를 정화합니다.
    - 제어 문자 제거
    - 지시문으로 보이는 라인 제거
    """
    if not text:
        return "", 0

    cleaned = _CONTROL_CHARS_RE.sub(" ", text)
    redacted_lines = 0
    safe_lines = []

    for line in cleaned.splitlines():
        if _looks_like_instruction(line):
            safe_lines.append(_REDACTED_LINE)
            redacted_lines += 1
        else:
            safe_lines.append(line)

    sanitized = "\n".join(safe_lines)

    if max_chars and len(sanitized) > max_chars:
        sanitized = sanitized[:max_chars] + "\n[TRUNCATED]"

    return sanitized, redacted_lines


def build_untrusted_context_block(
    text: str, label: str = "CONTEXT", max_chars: int = 0
) -> str:
    """
    LLM에게 전달할 컨텍스트 블록을 안전하게 구성합니다.
    """
    sanitized, redacted_lines = sanitize_untrusted_text(text, max_chars=max_chars)
    if not sanitized.strip():
        return ""

    header = f"[BEGIN {label} - UNTRUSTED]"
    if redacted_lines:
        header += f" (redacted {redacted_lines} line(s))"

    return f"{header}\n{sanitized}\n[END {label}]"
