from enum import Enum
from typing import Any

from fastapi import APIRouter

from connectors.postgres import PostgresConnector
from schemas.connector import DBConnectionTestRequest, DBConnectionTestResponse

router = APIRouter()


class SupportedDBType(str, Enum):
    POSTGRES = "postgres"
    # MYSQL = "mysql"


CONNECTOR_MAP = {
    SupportedDBType.POSTGRES: PostgresConnector,
    # SupportedDBType.MYSQL: MySQLConnector,
}


@router.post("/test", response_model=DBConnectionTestResponse)
async def test_db_connection(request: DBConnectionTestRequest) -> Any:
    """
    **DB 연결 테스트 API**

    DB 및 SSH 설정을 사용해서 실제 DB 접속 가능한지 테스트한다.

    Args:
      request (DBConnectionTestRequest): DB 접속 정보 및 SSH 설정

    Returns:
      DBConnectionTestResponse: 성공 여부 및 메세지
    """

    if request.type not in [db.value for db in SupportedDBType]:
        return DBConnectionTestResponse(
            success=False, message=f"지원하지 않는 DB 타입입니다: {request.type}"
        )

    config = request.model_dump()

    if config.get("ssh") and not config["ssh"].get("enabled"):
        config["ssh"] = None

    connector_class = CONNECTOR_MAP.get(request.type)

    if not connector_class:
        return DBConnectionTestResponse(
            success=False, message=f"커넥터를 찾을 수 없습니다. {request.type}"
        )

    try:
        connector = connector_class()
        is_connected = connector.check(config)

        if is_connected:
            return DBConnectionTestResponse(
                success=True, message="데이터베이스 연결에 성공했습니다."
            )
        else:
            return DBConnectionTestResponse(
                success=False, message="데이터베이스 연결에 실패했습니다."
            )

    except Exception as e:
        print(f"DB Connection Test ERror: {str(e)}")
        return DBConnectionTestResponse(success=False, message=f"연결 실패: {str(e)}")
