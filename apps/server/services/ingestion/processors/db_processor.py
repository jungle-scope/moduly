import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict

from services.ingestion.chunkers.adaptive_db_chunker import AdaptiveDbChunker
from services.ingestion.processors.base import BaseProcessor, ProcessingResult
from services.ingestion.transformers.db_nl_transformer import DbNlTransformer

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
            # 예: [{"table_name": "users", "columns": ["id", "email", "name"]}]

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
                            combined_schema_text += "\n"  # 테이블 간 구분

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

            # Adaptive Chunker 초기화
            enable_chunking = source_config.get("enable_auto_chunking", True)
            chunk_settings = source_config.get("chunk_settings", {})

            chunker = AdaptiveDbChunker(
                chunk_size=chunk_settings.get("chunk_size", 1000),
                chunk_overlap=chunk_settings.get("overlap", 150),
            )

            # JOIN 모드 체크
            join_config = source_config.get("join_config", {})
            if join_config.get("enabled", False) and len(selections) == 2:
                # 2테이블 JOIN 모드
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
            else:
                # 기존 방식: 각 테이블 독립 처리
                logger.info(f"Processing {len(selections)} table(s) independently")
                for selection in selections:
                    table_name = selection["table_name"]
                    columns = selection.get("columns", ["*"])  # 컬럼 선택
                    limit = source_config.get("limit", 1000)

                    # 템플릿 설정
                    template = selection.get("template", None)
                    aliases = selection.get("aliases", {})
                    sensitive_columns = selection.get("sensitive_columns", [])

                    # 템플릿 검증
                    if template and aliases:
                        from utils.template_utils import validate_template

                        is_valid, error_msg = validate_template(template, aliases)
                        if not is_valid:
                            raise Exception(f"Template validation failed: {error_msg}")

                    # COUNT(*) - 전체 개수 파악 (진행률 표시용)
                    count_query = f"SELECT COUNT(*) as total FROM {table_name}"
                    total_rows = 0
                    try:
                        for row in connector.fetch_data(config_dict, count_query):
                            total_rows = row.get("total", 0)
                            break
                    except Exception as e:
                        print(f"[WARNING] COUNT(*) failed: {e}")
                        total_rows = limit  # Fallback

                    print(
                        f"[INFO] Processing {table_name}: {total_rows} rows (max {limit})"
                    )

                    # 쿼리 생성
                    req_cols = ", ".join(columns)
                    query = f"SELECT {req_cols} FROM {table_name} LIMIT {limit}"

                    # 커넥터 실행 (Generator)
                    row_count = 0
                    for row_dict in connector.fetch_data(config_dict, query):
                        row_count += 1

                        # 진행률 로깅 (100개마다)
                        if row_count % 100 == 0:
                            progress = (
                                (row_count / total_rows) * 100 if total_rows > 0 else 0
                            )
                            print(
                                f"[Progress] {row_count}/{total_rows} ({progress:.1f}%)"
                            )

                        # 텍스트 변환 (Transformer - Jinja2 템플릿)
                        nl_text = transformer.transform(
                            row_dict, template_str=template, aliases=aliases
                        )

                        # 원본 데이터 암호화 (민감 필드만)
                        from utils.encryption import encryption_manager

                        # ✨ Decimal/datetime 등을 JSON 직렬화 가능한 타입으로 변환
                        original_data = self._convert_to_json_serializable(row_dict)

                        # 민감 컬럼 암호화
                        for col in sensitive_columns:
                            if col in original_data and original_data[col] is not None:
                                original_data[col] = encryption_manager.encrypt(
                                    str(original_data[col])
                                )

                        # 메타데이터 구성
                        metadata = {
                            "source": f"DB:{conn_record.name}:{table_name}",
                            "table": table_name,
                            "row_index": row_count,
                            "original_data": original_data,  # 원본 데이터 (민감 필드 암호화)
                            "sensitive_columns": sensitive_columns,
                        }

                        # ✨ Adaptive Chunking 적용
                        try:
                            row_chunks = chunker.chunk_if_needed(
                                text=nl_text,
                                metadata=metadata,
                                enable_chunking=enable_chunking,
                            )

                            chunks.extend(row_chunks)

                        except ValueError as e:
                            # 텍스트 너무 길 경우 에러 로깅
                            logger.error(f"Row {row_count} chunking failed: {e}")
                            # Skip this row or handle appropriately
                            continue

                    print(f"[INFO] Completed {table_name}: {row_count} chunks created")
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

        chunks = []
        limit = source_config.get("limit", 1000)
        enable_chunking = source_config.get("enable_auto_chunking", True)
        # JOIN 쿼리 생성
        query = generate_join_query(selections, join_config, limit)
        logger.info(f"Generated JOIN query: {query[:200]}...")
        # 템플릿 (전역 템플릿 사용)
        template_str = source_config.get("template", None)
        row_count = 0
        for row_dict in connector.fetch_data(config_dict, query):
            row_count += 1
            if row_count % 100 == 0:
                logger.info(f"JOIN processing: {row_count} rows")
            # 네임스페이스 변환
            namespaced_data = convert_to_namespace(row_dict)
            # 템플릿 렌더링
            if template_str:
                try:
                    template = Template(template_str)
                    nl_text = template.render(**namespaced_data)
                except Exception as e:
                    logger.error(f"Template rendering failed: {e}")
                    nl_text = str(namespaced_data)
            else:
                nl_text = str(namespaced_data)
            # 메타데이터
            metadata = {
                "source": f"DB:{conn_record.name}:JOIN",
                "tables": [s["table_name"] for s in selections],
                "row_index": row_count,
                "original_data": self._convert_to_json_serializable(row_dict),
            }
            # 청킹
            try:
                row_chunks = chunker.chunk_if_needed(
                    text=nl_text,
                    metadata=metadata,
                    enable_chunking=enable_chunking,
                )
                chunks.extend(row_chunks)
            except ValueError as e:
                logger.error(f"JOIN row {row_count} chunking failed: {e}")
                continue
        logger.info(f"JOIN completed: {row_count} rows, {len(chunks)} chunks")
        return chunks
