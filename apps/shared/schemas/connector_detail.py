from typing import Optional

from pydantic import BaseModel


class DBConnectionDetailResponse(BaseModel):
    id: str
    connection_name: str
    type: str
    host: str
    port: int
    database: str
    username: str
    # Password is explicitly excluded for security

    ssh: Optional[dict] = None  # Or define a specific SSH schema
