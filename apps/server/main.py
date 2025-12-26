from fastapi import FastAPI

from api.v1.endpoints.workflow import workflow_router

app = FastAPI()
app.include_router(workflow_router, prefix="/api/v1/workflows", tags=["workflows"])


@app.get("/")
def read_root():
    return {"Hello": "World from FastAPI"}
