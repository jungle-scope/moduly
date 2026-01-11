"""
Workflow Engine 라이프사이클 관리
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 라이프사이클 관리"""

    # === 시작 시 초기화 ===
    print("[WorkflowEngine] 서비스 시작 중...")

    # LogWorkerPool 초기화 (server의 것을 재사용)
    try:
        from workflow.core.log_worker_pool import init_log_worker_pool

        init_log_worker_pool()
        print("[WorkflowEngine] LogWorkerPool 초기화 완료")
    except Exception as e:
        print(f"[WorkflowEngine] LogWorkerPool 초기화 실패: {e}")

    print("[WorkflowEngine] Ready.")

    yield

    # === 종료 시 정리 ===
    print("[WorkflowEngine] 서비스 종료 중...")

    try:
        from workflow.core.log_worker_pool import shutdown_log_worker_pool

        shutdown_log_worker_pool()
        print("[WorkflowEngine] LogWorkerPool 종료 완료")
    except Exception as e:
        print(f"[WorkflowEngine] LogWorkerPool 종료 실패: {e}")

    print("[WorkflowEngine] Shutdown complete.")
