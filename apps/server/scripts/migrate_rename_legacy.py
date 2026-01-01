import os
import sys

# Add parent directory to path to allow imports if needed
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin123@localhost:5432/moduly")

def migrate():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        
        # 1. Check/Rename llm_provider -> legacy_llm_provider
        try:
            result = conn.execute(text("SELECT to_regclass('llm_provider')")).scalar()
            if result:
                print("Renaming llm_provider to legacy_llm_provider...")
                conn.execute(text("ALTER TABLE llm_provider RENAME TO legacy_llm_provider"))
            else:
                print("llm_provider table not found (maybe already renamed).")
        except Exception as e:
            print(f"Error renaming llm_provider: {e}")

        # 2. Check/Rename llm_credentials -> legacy_llm_credentials
        try:
            result = conn.execute(text("SELECT to_regclass('llm_credentials')")).scalar()
            if result:
                print("Renaming llm_credentials to legacy_llm_credentials...")
                conn.execute(text("ALTER TABLE llm_credentials RENAME TO legacy_llm_credentials"))
            else:
                print("llm_credentials table not found (maybe already renamed).")
        except Exception as e:
            print(f"Error renaming llm_credentials: {e}")
            
    print("Migration (Rename) completed.")

if __name__ == "__main__":
    migrate()
