from sqlalchemy import text
import sys
import os

# Add parent directory to path to import db.session
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.session import engine

def migrate():
    print("🚀 Starting manual migration...")
    try:
        with engine.begin() as conn:
            # 1. Add deployment_id column
            print("1️⃣ Adding 'deployment_id' column...")
            conn.execute(text("""
                ALTER TABLE workflow_runs 
                ADD COLUMN IF NOT EXISTS deployment_id UUID 
                REFERENCES workflow_deployments(id) ON DELETE SET NULL;
            """))
            
            # 2. Add workflow_version column
            print("2️⃣ Adding 'workflow_version' column...")
            conn.execute(text("""
                ALTER TABLE workflow_runs 
                ADD COLUMN IF NOT EXISTS workflow_version INTEGER;
            """))
            
        print("✅ Migration completed successfully!")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    migrate()
