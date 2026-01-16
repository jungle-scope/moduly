import os
import random
import sys
import uuid

# 프로젝트 루트 경로 추가
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import text

from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.db.session import SessionLocal
from apps.shared.utils.encryption import encryption_manager


def setup_perf_db(num_rows=1000):
    print(f"🚀 Setting up Real DB for Performance Test ({num_rows} rows)...")
    db = SessionLocal()

    try:
        # 1. 테스트용 테이블 생성 (Raw SQL)
        table_name = "perf_test_products"
        print(f"Creating table '{table_name}'...")
        db.execute(text(f"DROP TABLE IF EXISTS {table_name}"))
        db.execute(
            text(f"""
            CREATE TABLE {table_name} (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                description TEXT,
                price INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )

        # 2. 데이터 Insert
        print(f"Inserting {num_rows} rows...")
        values = []
        for i in range(num_rows):
            name = f"PerfProduct-{i}"
            desc = f"Description for product {i}. " * 5
            price = random.randint(1000, 99999)
            # Safe quoting for SQL (simple replacement for this script)
            values.append(f"('{name}', '{desc}', {price})")

        # Batch Insert
        batch_size = 1000
        for i in range(0, len(values), batch_size):
            batch = values[i : i + batch_size]
            sql = f"INSERT INTO {table_name} (name, description, price) VALUES {','.join(batch)}"
            db.execute(text(sql))

        print("Data insertion complete.")

        # 3. KnowledgeBase 및 Document 레코드 생성 (Moduly DB)
        user_id = uuid.uuid4()  # 테스트용 가상 유저
        kb_id = uuid.uuid4()
        doc_id = uuid.uuid4()

        print(f"Creating Metadata (KB: {kb_id}, Doc: {doc_id})...")

        kb = KnowledgeBase(
            id=kb_id,
            user_id=user_id,
            name="Performance Test KB",
            embedding_model="text-embedding-3-small",
            description="Auto-generated for perf test",
        )
        db.add(kb)

        # DB 연결 정보 (현재 로컬 DB 사용)
        # 실제 환경에서는 connection_id를 통해 Connection 테이블을 조회하지만,
        # 여기서는 DbProcessor가 로컬 연결을 사용하도록 하거나,
        # Connection 정보를 수동으로 주입해야 함.
        # 하지만 DbProcessor는 connection_id로 Connection을 찾아서 복호화함.
        # 따라서 Connection 레코드도 만들어야 함.

        # TODO: Connection 레코드는 암호화 등의 복잡성이 있으므로,
        # measure_sync 명령에서 source_config에 직접 db_url을 주입하는 방식으로 우회하거나
        # DbProcessor가 'connection_id'가 없을 때 직접 config를 쓰도록 수정 필요?
        # 아니면 여기서 Connection 레코드를 제대로 만들어야 함.

        # 여기서는 "DB_HOST" 등 환경변수를 사용하는 로컬 접속이라고 가정하고,
        # DbProcessor가 사용하는 Connection 조회 로직을 통과하기 위해
        # 임시 Connection 레코드를 하나 만듭니다.

        from apps.shared.db.models.connection import Connection

        conn_id = uuid.uuid4()
        # 로컬 DB 접속 정보 암호화
        db_password = os.getenv("DB_PASSWORD", "admin123")
        encrypted_pw = encryption_manager.encrypt(db_password)

        conn = Connection(
            id=conn_id,
            user_id=user_id,
            name="Perf Local DB",
            provider="postgres",
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            username=os.getenv("DB_USER", "postgres"),
            password=encrypted_pw,
            database=os.getenv("DB_NAME", "moduly"),  # 같은 DB 안의 테이블 조회
        )
        db.add(conn)

        doc = Document(
            id=doc_id,
            knowledge_base_id=kb_id,
            filename=table_name,
            source_type=SourceType.DB,
            meta_info={
                "db_config": {
                    "connection_id": str(conn_id),
                    "selections": [
                        {"table": table_name, "columns": ["name", "description"]}
                    ],
                }
            },
        )
        db.add(doc)

        db.commit()

        print("\n✅ Setup Complete!")
        print(f"KB ID: {kb_id}")
        print(f"User ID: {user_id}")
        print(f"Connection ID: {conn_id}")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=1000)
    args = parser.parse_args()

    setup_perf_db(args.rows)
