import logging
from typing import Any, Dict

from services.ingestion.processors.base import BaseProcessor, ProcessingResult
from services.ingestion.transformers.db_nl_transformer import DbNlTransformer

logger = logging.getLogger(__name__)

# Connector 의존성 (기존 Connector 재사용)
# 하지만 Connector 로직이 복잡하므로 Service layer를 거치거나 models.connection을 이용해 Connector를 띄워야 함.
# TODO: 여기서는 간단히 PostgresConnector를 예시로 사용. (실제로는 Factory에서 주입받거나 동적 로딩 필요)
# 순환 참조 방지를 위해 메서드 내부 import 권장


class DbProcessor(BaseProcessor):
    """
    [DbProcessor]
    외부 DB 연결 정보를 사용하여 SQL을 실행하고,
    결과 Row를 자연어로 변환하여 청킹합니다.
    """

    def process(self, source_config: Dict[str, Any]) -> ProcessingResult:
        """
        source_config: {
            "connection_id": "...",
            "sql": "SELECT * FROM ...",
            # 또는 meta_info에서 필요한 정보 전달
        }
        """
        connection_id = source_config.get("connection_id")
        if not connection_id:
            return ProcessingResult(
                chunks=[], metadata={"error": "No connection_id provided"}
            )

        # 1. DB 연결 정보 조회 (BaseProcessor의 self.db 사용)

        from db.models.connection import Connection
        # ConnectionService가 암호화된 비밀번호 복호화 로직 등을 가지고 있다고 가정

        conn_record = (
            self.db.query(Connection).filter(Connection.id == connection_id).first()
        )
        if not conn_record:
            return ProcessingResult(
                chunks=[], metadata={"error": "Connection not found"}
            )

        # 2. Connector 인스턴스 생성
        connector = self._get_connector(conn_record.type)
        if not connector:
            return ProcessingResult(
                metadata={"error": f"Unsupported DB type: {conn_record.type}"},
            )

        # 연결 설정 복호화

        from utils.encryption import encryption_manager

        try:
            # 개별 필드에서 설정 구성 및 비밀번호 복호화
            try:
                password = encryption_manager.decrypt(conn_record.encrypted_password)
            except Exception:
                # Decryption 실패 시 원본 값 사용 (개발 환경 등에서 암호화 안 된 경우)
                logger.warning(
                    f"Decryption failed for connection {connection_id}, using raw password"
                )
                password = conn_record.encrypted_password

            config_dict = {
                "host": conn_record.host,
                "port": conn_record.port,
                "database": conn_record.database,
                "username": conn_record.username,
                "password": password,
            }
        except Exception as e:
            return ProcessingResult(
                chunks=[], metadata={"error": f"Config setup failed: {str(e)}"}
            )

        # 3. 데이터 패칭 (Schema Info Fetching이 아니라 Data Fetching 메서드가 Connector에 필요)

        chunks = []
        try:
            # 사용자가 선택한 테이블/컬럼 정보(selections)를 기반으로 데이터 조회
            selections = source_config.get("selections", [])
            # 예: [{"table_name": "users", "columns": ["id", "email", "name"]}]

            transformer = DbNlTransformer()
            for selection in selections:
                table_name = selection["table_name"]
                columns = selection.get("columns", ["*"])  # 컬럼 선택 안하면 전체
                limit = source_config.get("limit", 1000)

                # 쿼리 생성
                req_cols = ", ".join(columns)
                query = f"SELECT {req_cols} FROM {table_name} LIMIT {limit}"

                # 커넥터 실행 (Generator)
                # fetch_data가 dict 형태({"col": "val"})로 yield 한다고 가정
                for row_dict in connector.fetch_data(config_dict, query):
                    # 텍스트 변환 (Transformer)
                    nl_text = transformer.transform(row_dict)

                    chunks.append(
                        {
                            "content": nl_text,
                            "metadata": {
                                "source": f"DB:{conn_record.name}:{table_name}",
                                "table": table_name,
                                # Primary Key 등을 식별할 수 있다면 좋음
                            },
                        }
                    )
        except Exception as e:
            return ProcessingResult(chunks=[], metadata={"error": str(e)})
        return ProcessingResult(
            chunks=chunks, metadata={"connection_id": str(connection_id)}
        )

    def _get_connector(self, db_type: str):
        if db_type == "postgres":
            from connectors.postgres import PostgresConnector

            return PostgresConnector()
        # 추후 mysql, oracle 등 추가
        return None
