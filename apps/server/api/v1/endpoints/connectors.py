from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from auth.dependencies import get_current_user
from connectors.postgres import PostgresConnector
from db.models.connection import Connection
from db.models.user import User
from schemas.connector import (
    DBConnectionTestRequest,
    DBConnectionTestResponse,
)
from utils.encryption import encryption_manager

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


@router.post("", status_code=201)
async def create_connection(
    request: DBConnectionTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    **DB 연결 정보 저장 API**

    연결 테스트한 후, 민감 정보를 암호화하여 저장합니다.
    """

    connector_class = CONNECTOR_MAP.get(request.type)
    if not connector_class:
        raise HTTPException(status_code=400, detail="지원하지 않는 DB타입입니다.")

    config_dict = request.model_dump()
    if config_dict.get("ssh") and not config_dict["ssh"].get("enabled"):
        config_dict["ssh"] = None

    try:
        connector = connector_class()
        if not connector.check(config_dict):
            raise HTTPException(
                status_code=400,
                detail="DB연결 테스트에 실패했습니다. 정보를 확인해주세요.",
            )
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"DB 연결 테스트 중 오류 발생: {str(e)}"
        )

    try:
        encrypted_password = encryption_manager.encrypt(request.password)
        encrypted_ssh_password = None
        encrypted_ssh_private_key = None

        if request.ssh and request.ssh.enabled:
            if request.ssh.password:
                encrypted_ssh_password = encryption_manager.encrypt(
                    request.ssh.password
                )
            if request.ssh.private_key:
                encrypted_ssh_private_key = encryption_manager.encrypt(
                    request.ssh.private_key
                )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"암호화 처리 중 오류 발생: {str(e)}"
        )

    new_connection = Connection(
        user_id=current_user.id,
        name=request.connection_name,
        type=request.type,
        host=request.host,
        port=request.port,
        database=request.database,
        username=request.username,
        encrypted_password=encrypted_password,
        # SSH
        use_ssh=request.ssh.enabled if request.ssh else False,
        ssh_host=request.ssh.host if request.ssh else None,
        ssh_port=request.ssh.port if request.ssh else None,
        ssh_username=request.ssh.username if request.ssh else None,
        ssh_auth_type=request.ssh.auth_type if request.ssh else None,
        encrypted_ssh_password=encrypted_ssh_password,
        encrypted_ssh_private_key=encrypted_ssh_private_key,
    )

    db.add(new_connection)
    db.commit()
    db.refresh(new_connection)

    return {
        "id": str(new_connection.id),
        "success": True,
        "message": "연결 정보가 안전하게 저장되었습니다.",
    }
