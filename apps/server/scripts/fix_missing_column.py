from sqlalchemy import text
from db.session import engine

def add_column():
    with engine.begin() as conn:
        print("🔨 Adding missing '_features' column to 'workflows' table...")
        try:
            conn.execute(text("ALTER TABLE workflows ADD COLUMN IF NOT EXISTS _features JSONB"))
            print("✅ Column '_features' added successfully!")
        except Exception as e:
            print(f"❌ Failed to add column: {e}")

if __name__ == "__main__":
    add_column()
