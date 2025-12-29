#!/usr/bin/env python3
"""Database reset script - Drops and recreates all tables"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text

from db.base import Base
from db.session import engine


def reset_database():
    print("🔄 Resetting database...")

    try:
        with engine.connect() as conn:
            conn.execute(text("COMMIT"))

            print("🔥 Dropping public schema CASCADE...")
            conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            conn.execute(text("COMMIT"))

            print("✨ Creating public schema...")
            conn.execute(text("CREATE SCHEMA public"))
            conn.execute(text("COMMIT"))

            print("🔑 Granting permissions...")
            conn.execute(text("GRANT ALL ON SCHEMA public TO admin"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
            conn.execute(text("COMMIT"))

        print("📦 Creating all tables...")
        Base.metadata.create_all(bind=engine)

        print("✅ Database reset complete!")
        print("⚠️  All data deleted. Please signup again.")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    reset_database()
