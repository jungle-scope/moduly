import os

from dotenv import load_dotenv

from connectors.postgres import PostgresConnector

load_dotenv()

db_config = {
    "host": "aws-1-ap-south-1.pooler.supabase.com",
    "port": "6543",
    "database": "postgres",
    "user": "postgres.gtumhvionhewnnjzftdx",
    "password": os.getenv("EXTERNAL_DB_PASSWORD"),
}

connector = PostgresConnector()

if connector.check(db_config):
    print("DB 연결 CHECK 성공..")

    tables = connector.discover(db_config)
    print(f"TABLE 목록 받아오기 성공.. --> {tables}")

    if "products" in tables:
        print("DB 데이터 배치 읽기 시작...")
        for batch in connector.read(db_config, "products", batch_size=2):
            print(f"배치 수신(2개씩): {batch}")
