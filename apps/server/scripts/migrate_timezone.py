from sqlalchemy import text
from db.session import engine

def migrate_timezones():
    sql_statements = [
        """
        ALTER TABLE apps 
        ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'UTC';
        """,
        """
        ALTER TABLE workflows 
        ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'UTC';
        """
    ]

    print("🚀 Starting Timezone Migration...")
    with engine.begin() as conn:
        for sql in sql_statements:
            print(f"Executing: {sql.strip().splitlines()[0]} ...")
            conn.execute(text(sql))
    print("✅ Migration completed successfully.")

if __name__ == "__main__":
    try:
        migrate_timezones()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
