from contextlib import asynccontextmanager

from fastapi import FastAPI
from shared.db.base import Base
from shared.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist (shared DB)
    print("[LogSystem] Checking database tables...")
    Base.metadata.create_all(bind=engine)
    print("[LogSystem] Ready.")

    yield

    print("[LogSystem] Shutting down.")
