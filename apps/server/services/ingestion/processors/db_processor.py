import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict

from services.ingestion.chunkers.adaptive_db_chunker import AdaptiveDbChunker
from services.ingestion.processors.base import BaseProcessor, ProcessingResult
from services.ingestion.transformers.db_nl_transformer import DbNlTransformer
from utils.encryption import encryption_manager

logger = logging.getLogger(__name__)


class DbProcessor(BaseProcessor):
    """
    [DbProcessor]
    외부 DB 연결 정보를 사용하여 SQL을 실행하고,
    결과 Row를 자연어로 변환하여 청킹합니다.
    """

    @staticmethod
    def _convert_to_json_serializable(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decimal, datetime 등 JSON 직렬화 불가능한 타입을 변환

        Args:
            data: 원본 row dictionary

        Returns:
            JSON 직렬화 가능한 dictionary
        """
        result = {}
        for key, value in data.items():
            if value is None:
                result[key] = None
            elif isinstance(value, Decimal):
                # Decimal -> float or int
                result[key] = float(value) if value % 1 else int(value)
            elif isinstance(value, (datetime, date)):
                # datetime/date -> ISO format string
                result[key] = value.isoformat()
            elif isinstance(value, (list, dict)):
                # 중첩된 구조는 그대로 (PostgreSQL JSON 타입 등)
                result[key] = value
            else:
                # str, int, float, bool 등은 그대로
                result[key] = value
        return result

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

        # DB 연결 정보 조회 (BaseProcessor의 self.db 사용)

        from apps.shared.db.models.connection import Connection

        conn_record = (
            self.db.query(Connection).filter(Connection.id == connection_id).first()
        )
        if not conn_record:
            return ProcessingResult(
                chunks=[], metadata={"error": "Connection not found"}
            )

        # Connector 인스턴스 생성
        connector = self._get_connector(conn_record.type)
        if not connector:
            return ProcessingResult(
                metadata={"error": f"Unsupported DB type: {conn_record.type}"},
            )

        # 연결 설정 복호화
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

            # SSH 설정 추가
            if conn_record.use_ssh:
                ssh_config = {
                    "enabled": True,
                    "host": conn_record.ssh_host,
                    "port": conn_record.ssh_port,
                    "username": conn_record.ssh_username,
                    "auth_type": conn_record.ssh_auth_type,
                }

                # SSH 인증 정보 복호화
                try:
                    if conn_record.ssh_auth_type == "key":
                        ssh_config["private_key"] = encryption_manager.decrypt(
                            conn_record.encrypted_ssh_private_key
                        )
                    else:
                        ssh_config["password"] = encryption_manager.decrypt(
                            conn_record.encrypted_ssh_password
                        )
                except Exception:
                    # 복호화 실패 시 원본 값 사용 (개발 환경 등)
                    logger.warning(
                        f"SSH Decryption failed for connection {connection_id}, using raw value"
                    )
                    if conn_record.ssh_auth_type == "key":
                        ssh_config["private_key"] = (
                            conn_record.encrypted_ssh_private_key
                        )
                    else:
                        ssh_config["password"] = conn_record.encrypted_ssh_password

                config_dict["ssh"] = ssh_config
        except Exception as e:
            return ProcessingResult(
                chunks=[], metadata={"error": f"Config setup failed: {str(e)}"}
            )

        # 3. 데이터 패칭
        chunks = []
        try:
            # 사용자가 선택한 테이블/컬럼 정보(selections)를 기반으로 데이터 조회
            selections = source_config.get("selections", [])

            # 모든 선택된 테이블의 스키마를 하나의 chunk로 생성
            try:
                schema_info = connector.get_schema_info(config_dict)
                if schema_info and selections:
                    combined_schema_text = ""
                    for selection in selections:
                        table_name = selection["table_name"]
                        table_schema = next(
                            (s for s in schema_info if s["table_name"] == table_name),
                            None,
                        )
                        if table_schema:
                            combined_schema_text += f"Table: {table_name}\nColumns:\n"
                            for col in table_schema.get("columns", []):
                                combined_schema_text += (
                                    f"- {col['name']} ({col['type']})\n"
                                )
                            combined_schema_text += "\n"

                    # 스키마를 첫 번째 chunk로 추가
                    if combined_schema_text:
                        chunks.append(
                            {
                                "content": combined_schema_text.strip(),
                                "metadata": {
                                    "source": f"DB:{conn_record.name}:schema",
                                    "type": "schema",
                                },
                            }
                        )
            except Exception as e:
                logger.warning(f"Failed to fetch schema info: {e}")

            transformer = DbNlTransformer()

            # 자동 Chunker 초기화
            chunk_settings = source_config.get("chunk_settings", {})

            chunker = AdaptiveDbChunker(
                chunk_size=chunk_settings.get("chunk_size", 1000),
                chunk_overlap=chunk_settings.get("overlap", 150),
            )

            # JOIN 모드 체크(2개까지만 허용)
            join_config = source_config.get("join_config", {})
            if join_config.get("enabled", False) and len(selections) == 2:
                logger.info(
                    f"Processing with JOIN mode: {selections[0]['table_name']} + {selections[1]['table_name']}"
                )
                join_chunks = self._process_with_join(
                    connector,
                    config_dict,
                    selections,
                    join_config,
                    source_config,
                    conn_record,
                    transformer,
                    chunker,
                )
                chunks.extend(join_chunks)
            # 단일 테이블인 경우
            else:
                chunks.extend(
                    self._process_single_table(
                        connector,
                        config_dict,
                        selections,
                        source_config,
                        conn_record,
                        transformer,
                        chunker,
                    )
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

    def _process_single_table(
        self,
        connector,
        config_dict,
        selections,
        source_config,
        conn_record,
        transformer,
        chunker,
    ):
        """단일 테이블 모드 처리"""
        if not selections:
            logger.warning("No tables selected for processing")
            return []

        selection = selections[0]
        table_name = selection["table_name"]
        logger.info(f"Processing single table: {table_name}")

        columns = selection.get("columns", ["*"])
        limit = source_config.get("limit", 1000)

        req_cols = ", ".join(columns)
        query = f"SELECT {req_cols} FROM {table_name} LIMIT {limit}"

        # Strategies
        def transform_strategy(row_dict):
            return transformer.transform(
                row_dict,
                template_str=selection.get("template"),
                aliases=selection.get("aliases"),
            )

        def encryption_key_strategy(table, col):
            return col

        return self._process_common_logic(
            connector,
            query,
            config_dict,
            selections,
            conn_record,
            transformer,
            chunker,
            source_config,
            transform_strategy,
            encryption_key_strategy,
        )

    def _process_with_join(
        self,
        connector,
        config_dict,
        selections,
        join_config,
        source_config,
        conn_record,
        transformer,
        chunker,
    ):
        """2테이블 JOIN 모드 처리"""
        from jinja2 import Template

        from utils.join_query_utils import convert_to_namespace, generate_join_query

        limit = source_config.get("limit", 1000)
        query = generate_join_query(selections, join_config, limit)
        logger.info(f"Generated JOIN query: {query[:200]}...")

        # 템플릿 (전역 템플릿 사용)
        template_str = source_config.get("template", None)
        if not template_str and selections:
            for sel in selections:
                if sel.get("template"):
                    template_str = sel.get("template")
                    break

        # Strategies
        def transform_strategy(row_dict):
            # 네임스페이스 변환
            namespaced_data = convert_to_namespace(row_dict)
            render_context = namespaced_data.copy()

            # Alias 적용
            for sel in selections:
                table = sel["table_name"]
                table_aliases = sel.get("aliases", {})
                if table in namespaced_data:
                    for col, val in namespaced_data[table].items():
                        if col in table_aliases:
                            render_context[table_aliases[col]] = val

            if template_str:
                try:
                    return Template(template_str).render(**render_context)
                except Exception as e:
                    logger.error(f"Template rendering failed: {e}")
                    return str(namespaced_data)
            return str(namespaced_data)

        def encryption_key_strategy(table, col):
            # JOIN 쿼리는 table__col 형식으로 키가 생성됨
            return f"{table}__{col}"

        return self._process_common_logic(
            connector,
            query,
            config_dict,
            selections,
            conn_record,
            transformer,
            chunker,
            source_config,
            transform_strategy,
            encryption_key_strategy,
        )

    def _process_common_logic(
        self,
        connector,
        query,
        config_dict,
        selections,
        conn_record,
        transformer,
        chunker,
        source_config,
        transform_strategy,
        encryption_key_strategy,
    ):
        """
        JOIN 모드와 단일 테이블 모드의 공통 처리 로직
        """
        chunks = []
        enable_chunking = source_config.get("enable_auto_chunking", True)

        row_count = 0
        logger.info("Executing query...")

        for row_dict in connector.fetch_data(config_dict, query):
            row_count += 1
            if row_count % 100 == 0:
                logger.info(f"Processing rows: {row_count}")

            # 1. 텍스트 변환 (Strategy)
            nl_text = transform_strategy(row_dict)

            # 2. 원본 데이터 직렬화
            original_data = self._convert_to_json_serializable(row_dict)

            # 3. 암호화 (Strategy)
            for sel in selections:
                table_name = sel["table_name"]
                sensitive_cols = sel.get("sensitive_columns", [])
                for col in sensitive_cols:
                    # 키 매핑 전략: (table_name, col) -> data_key
                    key = encryption_key_strategy(table_name, col)
                    if key in original_data and original_data[key] is not None:
                        original_data[key] = encryption_manager.encrypt(
                            str(original_data[key])
                        )

            # 4. 메타데이터 구성
            metadata = {
                "source": f"DB:{conn_record.name}:{'JOIN' if len(selections) > 1 else selections[0]['table_name']}",
                "tables": [s["table_name"] for s in selections],
                "row_index": row_count,
                "original_data": original_data,
                "sensitive_columns": [
                    c for s in selections for c in s.get("sensitive_columns", [])
                ],
            }

            # 5. 청킹
            try:
                row_chunks = chunker.chunk_if_needed(
                    text=nl_text,
                    metadata=metadata,
                    enable_chunking=enable_chunking,
                )
                chunks.extend(row_chunks)
            except ValueError as e:
                logger.error(f"Row {row_count} chunking failed: {e}")
                continue

        logger.info(f"Completed processing: {row_count} rows, {len(chunks)} chunks")
        return chunks
