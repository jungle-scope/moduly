from sqlalchemy import text
from db.session import engine

def check_table():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT to_regclass('public.workflow_runs')"))
        exists = result.scalar()
        print(f"Table 'workflow_runs' exists: {exists is not None}")

if __name__ == "__main__":
    check_table()
