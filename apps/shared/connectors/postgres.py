# 실제 Postgres(Supabase) 연결 로직
import logging
from io import StringIO

import paramiko
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL
from sshtunnel import SSHTunnelForwarder

from .base import BaseConnector

logger = logging.getLogger(__name__)


class PostgresConnector(BaseConnector):
    def _create_tunnel_and_engine(self, config):
        """
        SSH 터널과 SQLAlchemy Engine을 생성해서 반환한다.
        Returns:
            (engine, tunnel): tunnel은 SSH 미사용 시 None
        """
        tunnel = None
        db_host = config["host"]
        db_port = int(config.get("port", 5432))

        ssh_config = config.get("ssh", {})
        if ssh_config and ssh_config.get("enabled"):
            ssh_params = {
                "ssh_address_or_host": (ssh_config["host"], int(ssh_config["port"])),
                "ssh_username": ssh_config["username"],
                "remote_bind_address": (db_host, db_port),
            }

            # 인증방식에 따른 처리
            if ssh_config.get("auth_type") == "key":
                key_content = ssh_config["private_key"]
                pkey = paramiko.RSAKey.from_private_key(StringIO(key_content))
                ssh_params["ssh_pkey"] = pkey
            else:
                ssh_params["ssh_password"] = ssh_config.get("password")

            # 터널 생성 및 시작
            tunnel = SSHTunnelForwarder(**ssh_params)
            tunnel.start()

            db_host = "127.0.0.1"
            db_port = tunnel.local_bind_port

        db_url = URL.create(
            drivername="postgresql+psycopg2",
            username=config["username"],
            password=config["password"],
            host=db_host,
            port=db_port,
            database=config["database"],
        )
        engine = create_engine(db_url)

        return engine, tunnel

    def check(self, config):
        engine = None
        tunnel = None
        try:
            engine, tunnel = self._create_tunnel_and_engine(config)
            with engine.connect() as conn:
                # 간단한 쿼리 실행으로 연결 및 권한 확인
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"Postgres Connection failed: {e}")
            raise e
        finally:
            if engine:
                engine.dispose()
            if tunnel:
                tunnel.stop()

    def get_schema_info(self, config):
        engine = None
        tunnel = None
        try:
            engine, tunnel = self._create_tunnel_and_engine(config)

            # SQLAlchemy Inspector를 사용하여 DB 스키마 중립적으로 정보 조회
            inspector = inspect(engine)

            result = []
            # 'public' 스키마의 테이블 목록 조회 (필요시 schema 파라미터 조정 가능)
            for table_name in inspector.get_table_names():
                columns = []
                for col in inspector.get_columns(table_name):
                    columns.append(
                        {
                            "name": col["name"],
                            "type": str(col["type"]),
                        }
                    )

                # Foreign Key 정보 추출
                foreign_keys = []
                for fk in inspector.get_foreign_keys(table_name):
                    # fk 구조: {
                    #   'name': 'fk_orders_users',
                    #   'constrained_columns': ['user_id'],
                    #   'referred_table': 'users',
                    #   'referred_columns': ['id']
                    # }
                    if fk.get("constrained_columns") and fk.get("referred_columns"):
                        foreign_keys.append(
                            {
                                "column": fk["constrained_columns"][
                                    0
                                ],  # 첫 번째 컬럼만 (단순화)
                                "referenced_table": fk["referred_table"],
                                "referenced_column": fk["referred_columns"][0],
                            }
                        )

                result.append(
                    {
                        "table_name": table_name,
                        "columns": columns,
                        "foreign_keys": foreign_keys,  # FK 정보 추가
                    }
                )

            return result
        finally:
            if engine:
                engine.dispose()
            if tunnel:
                tunnel.stop()

    def fetch_data(self, config, query, batch_size=1000):
        engine = None
        tunnel = None
        try:
            engine, tunnel = self._create_tunnel_and_engine(config)

            # stream_results=True: 서버 사이드 커서를 사용하여 대용량 데이터도 메모리 터짐 없이 스트리밍
            with engine.connect().execution_options(stream_results=True) as conn:
                result_proxy = conn.execute(text(query))

                while True:
                    rows = result_proxy.fetchmany(batch_size)
                    if not rows:
                        break
                    for row in rows:
                        # Row 객체를 dict로 변환하여 반환
                        yield dict(row._mapping)

        finally:
            if engine:
                engine.dispose()
            if tunnel:
                tunnel.stop()
