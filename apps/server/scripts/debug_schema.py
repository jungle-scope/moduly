from sqlalchemy import text
from db.session import engine

def list_columns():
    with engine.connect() as conn:
        print("🔍 Checking columns in 'workflows' table...")
        result = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'workflows'"))
        columns = result.fetchall()
        
        found_features = False
        for col in columns:
            print(f" - {col[0]} ({col[1]})")
            if col[0] == '_features':
                found_features = True
                
        print("-" * 30)
        if found_features:
            print("✅ '_features' column EXISTS.")
        else:
            print("❌ '_features' column is MISSING.")

if __name__ == "__main__":
    list_columns()
