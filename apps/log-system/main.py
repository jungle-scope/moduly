from pathlib import Path

from dotenv import load_dotenv

# Load env before imports
BASE_DIR = Path(__file__).resolve().parent
APPS_DIR = BASE_DIR.parent
# Try loading from local, then project root
LOCAL_ENV_PATH = BASE_DIR / ".env"
ROOT_ENV_PATH = APPS_DIR.parent / ".env"

if LOCAL_ENV_PATH.exists():
    print(f"[LogSystem] Loading .env from {LOCAL_ENV_PATH}")
    load_dotenv(dotenv_path=LOCAL_ENV_PATH)
elif ROOT_ENV_PATH.exists():
    print(f"[LogSystem] Loading .env from {ROOT_ENV_PATH}")
    load_dotenv(dotenv_path=ROOT_ENV_PATH)

from api.v1.endpoints import logs
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from lifespan import lifespan

app = FastAPI(title="Moduly Log System", lifespan=lifespan)

# Allow internal service communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logs.router, prefix="/logs", tags=["logs"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "log-system"}
