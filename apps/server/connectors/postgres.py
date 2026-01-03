# 실제 Postgres(Supabase) 연결 로직
import psycopg2

from .base import BaseConnector


class PostgresConnector(BaseConnector):
    def _get_connection(self, config):
        # SSL 모드를 필수로 포함하여 연결 생성
        return psycopg2.connect(
            host=config["host"],
            port=config["port"],
            database=config["database"],
            user=config["username"],
            password=config["password"],
            sslmode="require",
        )

    def check(self, config):
        try:
            conn = self._get_connection(config)
            conn.close()
            return True
        except Exception as e:
            print(f"Postgre Connection faield: {e}")
            return False

    def discover(self, config):
        conn = self._get_connection(config)
        cur = conn.cursor()
        # 공용스키마에 있는 테이블 목록 조히
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        )
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        conn.close()
        return tables

    def read(self, config, table_name, batch_size=1000):
        conn = self._get_connection(config)
        cur = conn.cursor(name="fetch_large_data")
        cur.execute(f"SELECT * FROM {table_name}")

        while True:
            rows = cur.fetchmany(batch_size)
            if not rows:
                break
            yield rows  # 데이터를 한번에 다 주지않고 묶음으로 전달한다

        cur.close()
        conn.close()
