from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from workflow.nodes.base.entities import BaseNodeData


class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class HttpHeader(BaseModel):
    key: str
    value: str


class HttpRequestNodeData(BaseNodeData):
    """
    HTTP Request Node 설정 데이터
    """

    method: HttpMethod = Field(HttpMethod.GET, description="HTTP 메서드")
    url: str = Field(..., description="요청 URL")
    headers: List[HttpHeader] = Field(
        default_factory=list, description="HTTP 헤더 목록"
    )
    body: Optional[str] = Field(None, description="요청 본문 (JSON string)")
    timeout: int = Field(5000, description="타임아웃 (ms)")
    authType: str = Field("none", description="인증 타입 (none, bearer, apiKey)")
    authConfig: Dict[str, Any] = Field(
        default_factory=dict, description="인증 설정 (token, apiKeyHeader, apiKeyValue)"
    )
