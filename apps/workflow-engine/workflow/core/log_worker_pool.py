"""
애플리케이션 레벨 로그 워커 풀

싱글톤 패턴으로 구현되어 모든 WorkflowLogger 인스턴스가 공유합니다.
기존에 WorkflowLogger가 인스턴스마다 스레드를 생성하던 것을 개선하여,
애플리케이션 전체에서 고정된 수의 워커 스레드를 공유합니다.

[사용법]
1. 앱 시작 시: init_log_worker_pool(worker_count=4)
2. WorkflowLogger에서: get_log_worker_pool().submit(task)
3. 앱 종료 시: shutdown_log_worker_pool()
"""

import os
import queue
import threading
from typing import Any, Dict, List, Optional


class LogWorkerPool:
    """
    공유 로그 워커 풀 (싱글톤)

    애플리케이션 시작 시 초기화되고, 종료 시 정리됩니다.
    모든 WorkflowLogger가 이 풀의 큐를 공유합니다.
    """

    _instance: Optional["LogWorkerPool"] = None
    _lock = threading.Lock()

    # 기본 설정 (환경 변수로 오버라이드 가능)
    DEFAULT_WORKER_COUNT = 4
    DEFAULT_QUEUE_SIZE = 10000
    DEFAULT_SHUTDOWN_TIMEOUT = 10.0

    def __new__(cls, *args, **kwargs):
        # 스레드 안전 싱글톤을 위한 Double-Checked Locking
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, worker_count: int = None, queue_size: int = None):
        """
        LogWorkerPool 초기화

        Args:
            worker_count: 워커 스레드 수 (기본값: 4, 환경변수 LOG_WORKER_COUNT로 설정 가능)
            queue_size: 큐 최대 크기 (기본값: 10000, 환경변수 LOG_QUEUE_SIZE로 설정 가능)
        """
        # 이미 초기화된 경우 스킵 (싱글톤)
        if self._initialized:
            return

        # 환경 변수 또는 인자값 사용
        self.worker_count = worker_count or int(
            os.getenv("LOG_WORKER_COUNT", self.DEFAULT_WORKER_COUNT)
        )
        self.queue_size = queue_size or int(
            os.getenv("LOG_QUEUE_SIZE", self.DEFAULT_QUEUE_SIZE)
        )
        self.shutdown_timeout = float(
            os.getenv("LOG_WORKER_SHUTDOWN_TIMEOUT", self.DEFAULT_SHUTDOWN_TIMEOUT)
        )

        self.log_queue: queue.Queue = queue.Queue(maxsize=self.queue_size)
        self._is_shutdown = False
        self._shutdown_lock = threading.Lock()
        self.workers: List[threading.Thread] = []

        self._initialized = True

    def start(self):
        """
        워커 풀 시작 (앱 시작 시 호출)

        Raises:
            RuntimeError: 이미 종료된 풀을 다시 시작하려는 경우
        """
        if self._is_shutdown:
            raise RuntimeError("LogWorkerPool이 이미 종료되어 다시 시작할 수 없습니다")

        if self.workers:
            # 이미 시작된 경우 스킵
            return

        for i in range(self.worker_count):
            worker = threading.Thread(
                target=self._worker_loop,
                name=f"LogWorker-{i}",
                daemon=True,
            )
            worker.start()
            self.workers.append(worker)

        print(
            f"[LogWorkerPool] {self.worker_count}개의 워커로 시작됨 (큐 크기={self.queue_size})"
        )

    def shutdown(self, timeout: float = None):
        """
        워커 풀 종료 (앱 종료 시 호출)

        큐에 남은 모든 작업을 처리한 후 워커 스레드들을 종료합니다.

        Args:
            timeout: 종료 대기 최대 시간 (초, 기본값: LOG_WORKER_SHUTDOWN_TIMEOUT)
        """
        with self._shutdown_lock:
            if self._is_shutdown:
                return
            self._is_shutdown = True

        timeout = timeout or self.shutdown_timeout

        # 종료 신호 전송 (워커 수만큼 None을 큐에 넣음)
        for _ in self.workers:
            try:
                self.log_queue.put(None, timeout=1.0)
            except queue.Full:
                pass  # 큐가 가득 차도 종료 진행

        # 모든 워커 종료 대기
        per_worker_timeout = timeout / max(len(self.workers), 1)
        for worker in self.workers:
            worker.join(timeout=per_worker_timeout)

        self.workers.clear()
        print("[LogWorkerPool] 정상 종료 완료")

    def submit(self, task: Dict[str, Any]):
        """
        로그 작업을 큐에 제출

        Args:
            task: 로그 작업 데이터 (type, data 필드 포함)

        Raises:
            RuntimeError: 풀이 종료된 경우
        """
        if self._is_shutdown:
            # 종료 중에는 작업을 조용히 드롭 (에러 raise 대신)
            print(f"[LogWorkerPool] 경고: 종료 후 작업 드롭됨: {task.get('type')}")
            return

        try:
            self.log_queue.put(task, timeout=1.0)
        except queue.Full:
            # 백프레셔: 큐가 가득 차면 작업 드롭 (시스템 안정성 우선)
            print(
                f"[LogWorkerPool] 경고: 큐가 가득 차서 작업 드롭됨: {task.get('type')}"
            )

    def _worker_loop(self):
        """워커 스레드 메인 루프"""
        import json
        import uuid
        from datetime import datetime

        # JSON 시리얼라이저 헬퍼
        class JSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, uuid.UUID):
                    return str(obj)
                if isinstance(obj, datetime):
                    return obj.isoformat()
                return super().default(obj)

        log_system_url = os.getenv("LOG_SYSTEM_URL", "http://localhost:8002").rstrip(
            "/"
        )

        try:
            while True:
                try:
                    task = self.log_queue.get(timeout=1.0)
                except queue.Empty:
                    if self._is_shutdown:
                        break
                    continue

                if task is None:
                    break

                try:
                    self._process_task_http(task, log_system_url, JSONEncoder)
                except Exception as e:
                    print(f"[LogWorkerPool] 로그 전송 실패: {e}")
                finally:
                    self.log_queue.task_done()
        finally:
            pass

    def _process_task_http(self, task: Dict[str, Any], base_url: str, encoder_cls):
        """HTTP로 로그 시스템에 전송"""
        import json

        import httpx

        task_type = task.get("type")
        data = task.get("data")

        url = ""
        method = "POST"
        payload = data

        if task_type == "create_run":
            url = f"{base_url}/logs/runs"
            method = "POST"
            payload = {
                "id": data.get("run_id"),
                "workflow_id": data.get("workflow_id"),
                "user_id": data.get("user_id"),
                "status": "running",
                "trigger_mode": "deployed" if data.get("is_deployed") else "manual",
                "inputs": data.get("user_input"),
                "started_at": data.get("started_at"),
                "workflow_version": data.get("workflow_version"),
                "deployment_id": data.get("deployment_id"),
            }
        elif task_type == "update_run_finish":
            run_id = data.get("run_id")
            url = f"{base_url}/logs/runs/{run_id}"
            method = "PATCH"
            payload = {
                "status": "success",
                "outputs": data.get("outputs"),
                "finished_at": data.get("finished_at"),
            }
        elif task_type == "update_run_error":
            run_id = data.get("run_id")
            url = f"{base_url}/logs/runs/{run_id}"
            method = "PATCH"
            payload = {
                "status": "failed",
                "error_message": data.get("error_message"),
                "finished_at": data.get("finished_at"),
            }
        elif task_type == "create_node":
            run_id = data.get("workflow_run_id")
            url = f"{base_url}/logs/runs/{run_id}/nodes"
            method = "POST"
            payload = {
                "node_id": data.get("node_id"),
                "node_type": data.get("node_type"),
                "status": "running",
                "inputs": data.get("inputs"),
                "started_at": data.get("started_at"),
            }
        elif task_type == "update_node_finish":
            run_id = data.get("workflow_run_id")
            node_id = data.get("node_id")
            url = f"{base_url}/logs/runs/{run_id}/nodes/{node_id}"
            method = "PATCH"
            payload = {
                "status": "success",
                "outputs": data.get("outputs"),
                "finished_at": data.get("finished_at"),
            }
        elif task_type == "update_node_error":
            run_id = data.get("workflow_run_id")
            node_id = data.get("node_id")
            url = f"{base_url}/logs/runs/{run_id}/nodes/{node_id}"
            method = "PATCH"
            payload = {
                "status": "failed",
                "error_message": data.get("error_message"),
                "finished_at": data.get("finished_at"),
            }
        else:
            print(f"[LogWorkerPool] 알 수 없는 작업 타입: {task_type}")
            return

        # 데이터 직렬화 (UUID, datetime 처리)
        json_data = json.loads(json.dumps(payload, cls=encoder_cls))

        try:
            if method == "POST":
                mk_req = httpx.post(url, json=json_data, timeout=5.0)
            else:
                mk_req = httpx.patch(url, json=json_data, timeout=5.0)

            if mk_req.status_code >= 400:
                print(f"[LogWorkerPool] API 에러 ({mk_req.status_code}): {mk_req.text}")
        except Exception as e:
            print(f"[LogWorkerPool] 전송 실패: {e}")


# ==============================
# 모듈 레벨 헬퍼 함수
# ==============================

_pool_instance: Optional[LogWorkerPool] = None


def init_log_worker_pool(
    worker_count: int = None, queue_size: int = None
) -> LogWorkerPool:
    """
    LogWorkerPool 초기화 및 시작

    앱 시작(lifespan) 시 한 번 호출됩니다.

    Args:
        worker_count: 워커 스레드 수 (기본값: 4)
        queue_size: 큐 최대 크기 (기본값: 10000)

    Returns:
        LogWorkerPool: 초기화된 풀 인스턴스
    """
    global _pool_instance
    _pool_instance = LogWorkerPool(worker_count, queue_size)
    _pool_instance.start()
    return _pool_instance


def get_log_worker_pool() -> LogWorkerPool:
    """
    현재 활성화된 LogWorkerPool 인스턴스 반환

    Returns:
        LogWorkerPool: 활성 풀 인스턴스

    Raises:
        RuntimeError: 풀이 초기화되지 않은 경우
    """
    if _pool_instance is None:
        raise RuntimeError(
            "LogWorkerPool이 초기화되지 않았습니다. "
            "init_log_worker_pool()을 먼저 호출하세요."
        )
    return _pool_instance


def shutdown_log_worker_pool():
    """
    LogWorkerPool 종료

    앱 종료(lifespan) 시 호출됩니다.
    """
    global _pool_instance
    if _pool_instance:
        _pool_instance.shutdown()
        _pool_instance = None
