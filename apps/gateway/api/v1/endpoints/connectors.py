from enum import Enum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from apps.gateway.api.deps import get_db
from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.connectors.postgres import PostgresConnector
from apps.shared.db.models.connection import Connection
from apps.shared.db.models.user import User
from apps.shared.schemas.connector import (
    DBConnectionTestRequest,
    DBConnectionTestResponse,
)
from apps.shared.schemas.connector_detail import DBConnectionDetailResponse
from apps.gateway.utils.encryption import encryption_manager

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
        from starlette.concurrency import run_in_threadpool

        connector = connector_class()
        # blocking I/O (SSH connection, DB connection)를 별도 스레드에서 실행
        is_connected = await run_in_threadpool(connector.check, config)

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
        import asyncio

        from starlette.concurrency import run_in_threadpool

        connector = connector_class()

        # blocking I/O (SSH connection, DB connection)를 별도 스레드에서 실행
        # 10초 타임아웃 적용
        try:
            is_connected = await asyncio.wait_for(
                run_in_threadpool(connector.check, config_dict), timeout=10.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=400,
                detail="연결 시간 초과 (10초). 방화벽(보안그룹)이나 IP 허용 설정을 확인해주세요.",
            )

        if not is_connected:
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


@router.get("/{connection_id}", response_model=DBConnectionDetailResponse)
async def get_connection_details(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    **DB 연결 상세 정보 조회 API**
    저장된 연결 정보(Host, Port 등)를 반환합니다. (비밀번호 제외)
    """
    connection = db.query(Connection).filter(Connection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if connection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    ssh_config = None
    if connection.use_ssh:
        ssh_config = {
            "enabled": True,
            "host": connection.ssh_host,
            "port": connection.ssh_port,
            "username": connection.ssh_username,
            "auth_type": connection.ssh_auth_type,
            # Passwords/Keys are not returned
        }

    return DBConnectionDetailResponse(
        id=str(connection.id),
        connection_name=connection.name,
        type=connection.type,
        host=connection.host,
        port=connection.port,
        database=connection.database,
        username=connection.username,
        ssh=ssh_config,
    )


# 스키마 조회 API 추가
@router.get("/{connection_id}/schema")
async def get_connection_schema(
    connection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    **DB 스키마 조회 API**
    저장된 연결 정보를 복호화하여 DB에 접속하고, 테이블 정보를 가져옵니다.
    """
    connection = db.query(Connection).filter(Connection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if connection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    # 복호화 및 설정 재구성
    try:
        password = encryption_manager.decrypt(connection.encrypted_password)
        ssh_config = None
        if connection.use_ssh:
            ssh_password = None
            ssh_private_key = None
            if connection.encrypted_ssh_password:
                ssh_password = encryption_manager.decrypt(
                    connection.encrypted_ssh_password
                )
            if connection.encrypted_ssh_private_key:
                ssh_private_key = encryption_manager.decrypt(
                    connection.encrypted_ssh_private_key
                )
            ssh_config = {
                "enabled": True,
                "host": connection.ssh_host,
                "port": connection.ssh_port,
                "username": connection.ssh_username,
                "auth_type": connection.ssh_auth_type,
                "password": ssh_password,
                "private_key": ssh_private_key,
            }
        config = {
            "type": connection.type,
            "host": connection.host,
            "port": connection.port,
            "database": connection.database,
            "username": connection.username,
            "password": password,
            "ssh": ssh_config,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")
    connector_class = CONNECTOR_MAP.get(connection.type)
    if not connector_class:
        raise HTTPException(status_code=400, detail="Unsupported DB type")
    try:
        connector = connector_class()
        tables = connector.get_schema_info(config)
        return {"tables": tables}
    except Exception as e:
        print(f"Schema Fetch Error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch schema: {str(e)}")
