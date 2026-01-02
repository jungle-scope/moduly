from sqlalchemy import text
from db.base import Base
from db.session import engine
# Ensure models are registered with Base
from db.models.user import User
from db.models.workflow import Workflow
from db.models.workflow_run import WorkflowRun, WorkflowNodeRun
from db.models.llm import LLMProvider, LLMUsageLog

def add_workflow_run_id_column():
    """
    Safely adds workflow_run_id column to llm_usage_logs table if it doesn't exist.
    Also ensures new tables (WorkflowRun, WorkflowNodeRun) are created.
    """
    check_sql = text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='llm_usage_logs' AND column_name='workflow_run_id';
    """)
    
    add_column_sql = text("""
        ALTER TABLE llm_usage_logs 
        ADD COLUMN workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL;
    """)

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    print("✅ Verified/Created all database tables.")

    with engine.begin() as conn:
        result = conn.execute(check_sql).fetchone()
        if not result:
            print("🔄 Adding 'workflow_run_id' column to 'llm_usage_logs'...")
            conn.execute(add_column_sql)
            print("✅ Column added successfully.")
        else:
            print("ℹ️ Column 'workflow_run_id' already exists.")

if __name__ == "__main__":
    try:
        add_workflow_run_id_column()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
