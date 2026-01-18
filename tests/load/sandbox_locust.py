from locust import HttpUser, task, between, tag
import random
import json

class SandboxUser(HttpUser):
    # 유저 한 명이 요청을 보내고 다음 요청까지 대기하는 시간 (초)
    wait_time = between(1, 3)

    @tag('fast')
    @task(6)  # 가중치 60%
    def run_fast_job(self):
        """
        [Fast Job] 단순 연산 (예상: < 100ms)
        - Trigger: manual (High Priority Fallback)
        """
        payload = {
            "code": "def main(args): return {'result': args.get('x', 0) + 1}",
            "inputs": {"x": 10},
            "trigger_type": "manual",
            "timeout": 5
        }
        # name 파라미터로 리포트에서 별도 항목으로 집계
        self.client.post("/v1/sandbox/execute", json=payload, name="Fast Job (Manual)")

    @tag('slow')
    @task(3)  # 가중치 30%
    def run_slow_job(self):
        """
        [Slow Job] 2초 대기 (예상: ~2000ms)
        - Trigger: schedule (Low Priority Fallback)
        """
        payload = {
            "code": "import time\ndef main(args): time.sleep(2); return {'msg': 'done'}",
            "inputs": {},
            "trigger_type": "schedule",
            "timeout": 10
        }
        self.client.post("/v1/sandbox/execute", json=payload, name="Slow Job (Schedule)")

    @tag('heavy')
    @task(1)  # 가중치 10%
    def run_heavy_memory_job(self):
        """
        [Heavy Job] 메모리 할당 테스트
        - Trigger: api (Normal Priority Fallback)
        """
        # 약 10MB 리스트 생성
        code = """
def main(args):
    data = [i for i in range(1000000)]
    return {'len': len(data)}
"""
        payload = {
            "code": code,
            "inputs": {},
            "trigger_type": "api",
            "timeout": 10
        }
        self.client.post("/v1/sandbox/execute", json=payload, name="Heavy Job (API)")

    def on_start(self):
        """테스트 시작 시 실행"""
        pass
