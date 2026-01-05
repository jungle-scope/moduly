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

    def get_schema_info(self, config):
        conn = self._get_connection(config)
        cur = conn.cursor()

        # 테이블 및 컬럼 정보 조회 query
        query = """
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position
        """
        cur.execute(query)
        rows = cur.fetchall()

        # 데이터 구조화
        schema_info = {}
        for table, col, dtype in rows:
            if table not in schema_info:
                schema_info[table] = []
            schema_info[table].append({"name": col, "type": dtype})

        # 리스트 형태로 변환
        result = []
        for table, columns in schema_info.items():
            result.append({"table_name": table, "columns": columns})

        cur.close()
        conn.close()
        return result

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

    def fetch_data(self, config, query, batch_size=1000):
        conn = self._get_connection(config)

        import psycopg2.extras

        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            cur.execute(query)
            while True:
                rows = cur.fetchmany(batch_size)
                if not rows:
                    break
                for row in rows:
                    yield dict(row)  # RealDictRow -> dict 변환
        finally:
            cur.close()
            conn.close()
