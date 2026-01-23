"""
Sandbox Load Test - FIFO vs SJF Scheduler Comparison

실행 방법:
=========

1. Locust 설치:
   pip install locust

2. 샌드박스 서버 실행 (Docker 또는 로컬):
   - Docker: docker-compose up sandbox
   - 로컬: python -m apps.sandbox.main

3. FIFO 모드 테스트 (베이스라인):
   set SANDBOX_FORCE_FIFO=true  # Windows
   export SANDBOX_FORCE_FIFO=true  # Linux/Mac
   locust -f tests/load/sandbox_locust.py --host=http://localhost:8001 --headless -u 30 -r 5 -t 2m --csv=results/fifo

4. SJF 모드 테스트 (최적화):
   set SANDBOX_FORCE_FIFO=false  # Windows
   export SANDBOX_FORCE_FIFO=false  # Linux/Mac
   locust -f tests/load/sandbox_locust.py --host=http://localhost:8001 --headless -u 30 -r 5 -t 2m --csv=results/sjf

5. Web UI로 실행 (인터랙티브):
   locust -f tests/load/sandbox_locust.py --host=http://localhost:8001
   -> 브라우저에서 http://localhost:8089 접속

환경변수 (선택):
==============
- SANDBOX_HOST: 샌드박스 서버 URL (기본: http://localhost:8001)
- TEST_TENANT_COUNT: 테넌트 수 (기본: 5)
- TEST_FAST_WEIGHT: Fast Job 가중치 (기본: 6)
- TEST_SLOW_WEIGHT: Slow Job 가중치 (기본: 3)
- TEST_HEAVY_WEIGHT: Heavy Job 가중치 (기본: 1)

결과 분석:
=========
CSV 파일에서 다음을 비교:
- Fast Job P50/P95/P99: SJF가 FIFO보다 낮아야 함
- Slow Job이 Fast Job을 블로킹하는 정도
- 전체 처리량 (RPS)
"""
from locust import HttpUser, task, between, tag, events
import random
import os
import json
import time
from datetime import datetime

# 환경변수 설정
TENANT_COUNT = int(os.getenv("TEST_TENANT_COUNT", "5"))
FAST_WEIGHT = int(os.getenv("TEST_FAST_WEIGHT", "6"))
SLOW_WEIGHT = int(os.getenv("TEST_SLOW_WEIGHT", "3"))
HEAVY_WEIGHT = int(os.getenv("TEST_HEAVY_WEIGHT", "1"))


class SandboxUser(HttpUser):
    """샌드박스 부하 테스트 유저"""
    
    # 요청 간 대기 시간 (스케줄링 효과를 보려면 짧게)
    wait_time = between(0.1, 0.5)
    
    def on_start(self):
        """테스트 시작 시 랜덤 tenant_id 할당"""
        self.tenant_id = f"tenant_{random.randint(1, TENANT_COUNT)}"
        self.user_start_time = time.time()
    
    @tag('fast')
    @task(FAST_WEIGHT)
    def run_fast_job(self):
        """
        [Fast Job] 단순 연산 (예상: < 50ms)
        - Trigger: manual (High Priority Fallback)
        - SJF 스케줄러에서는 과거 기록 기반으로 HIGH 우선순위 할당 예상
        """
        payload = {
            "code": "def main(args): return {'result': args.get('x', 0) + args.get('y', 0)}",
            "inputs": {"x": random.randint(1, 100), "y": random.randint(1, 100)},
            "trigger_type": "manual",
            "timeout": 5,
            "tenant_id": self.tenant_id,
        }
        
        with self.client.post(
            "/v1/sandbox/execute",
            json=payload,
            name="[FAST] Simple Calc (manual)",
            catch_response=True
        ) as response:
            self._validate_response(response, expected_fast=True)
    
    @tag('slow')
    @task(SLOW_WEIGHT)
    def run_slow_job(self):
        """
        [Slow Job] 1.5초 대기 (예상: ~1500ms)
        - Trigger: schedule (Low Priority Fallback)
        - SJF 스케줄러에서는 과거 기록 기반으로 LOW 우선순위 할당 예상
        """
        sleep_time = 1.5
        payload = {
            "code": f"import time\ndef main(args): time.sleep({sleep_time}); return {{'slept': {sleep_time}}}",
            "inputs": {},
            "trigger_type": "schedule",
            "timeout": 10,
            "tenant_id": self.tenant_id,
        }
        
        with self.client.post(
            "/v1/sandbox/execute",
            json=payload,
            name="[SLOW] Sleep 1.5s (schedule)",
            catch_response=True
        ) as response:
            self._validate_response(response, expected_fast=False, min_time_ms=1400)
    
    @tag('heavy')
    @task(HEAVY_WEIGHT)
    def run_heavy_memory_job(self):
        """
        [Heavy Job] 메모리 할당 + 연산 (예상: ~500ms)
        - Trigger: api (Normal Priority Fallback)
        - 약 5MB 리스트 생성 후 합계 계산
        """
        code = """
def main(args):
    size = args.get('size', 500000)
    data = [i for i in range(size)]
    return {'sum': sum(data), 'len': len(data)}
"""
        payload = {
            "code": code,
            "inputs": {"size": 500000},
            "trigger_type": "api",
            "timeout": 10,
            "tenant_id": self.tenant_id,
        }
        
        with self.client.post(
            "/v1/sandbox/execute",
            json=payload,
            name="[HEAVY] Memory Alloc (api)",
            catch_response=True
        ) as response:
            self._validate_response(response, expected_fast=False)
    
    @tag('burst')
    @task(0)  # 기본적으로 비활성화, --tags burst로 활성화
    def run_burst_jobs(self):
        """
        [Burst Test] 동일 테넌트에서 연속 요청
        - Fair Scheduler의 테넌트 제한(MAX_PER_TENANT) 테스트
        """
        for i in range(5):
            payload = {
                "code": f"def main(args): return {{'batch': {i}}}",
                "inputs": {},
                "trigger_type": "api",
                "timeout": 5,
                "tenant_id": self.tenant_id,
            }
            self.client.post(
                "/v1/sandbox/execute",
                json=payload,
                name=f"[BURST] Batch {i+1}/5",
            )
    
    def _validate_response(
        self,
        response,
        expected_fast: bool = False,
        min_time_ms: float = 0,
    ):
        """응답 검증 및 성능 체크"""
        try:
            if response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
                return
            
            data = response.json()
            
            if not data.get("success"):
                error = data.get("error", "Unknown error")
                error_type = data.get("error_type", "unknown")
                response.failure(f"{error_type}: {error}")
                return
            
            # 실행 시간 검증
            exec_time = data.get("execution_time_ms", 0)
            
            if min_time_ms > 0 and exec_time < min_time_ms:
                response.failure(f"Too fast: {exec_time}ms < {min_time_ms}ms expected")
                return
            
            # Fast Job이 너무 느리면 경고 (SJF 효과 부족 가능성)
            if expected_fast and exec_time > 500:
                # 실패는 아니지만 로그에 기록
                pass
            
            response.success()
            
        except json.JSONDecodeError:
            response.failure("Invalid JSON response")
        except Exception as e:
            response.failure(str(e))


class MetricsCollector(HttpUser):
    """
    메트릭 수집 전용 유저
    - 주기적으로 /metrics 엔드포인트 호출
    - 스케줄러 상태 모니터링
    """
    
    # 메트릭 수집 주기 (초)
    wait_time = between(5, 5)
    
    # 이 유저는 1명만 생성
    weight = 0  # 기본적으로 비활성화
    
    @task
    def collect_metrics(self):
        """스케줄러 메트릭 수집"""
        with self.client.get(
            "/v1/sandbox/metrics",
            name="[METRICS] Scheduler Stats",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                metrics = response.json()
                # 콘솔에 주요 메트릭 출력
                print(f"\n📊 Scheduler Metrics @ {datetime.now().strftime('%H:%M:%S')}")
                print(f"   Queue: HIGH={metrics.get('queue_high', 0)} | NORMAL={metrics.get('queue_normal', 0)} | LOW={metrics.get('queue_low', 0)}")
                print(f"   Workers: {metrics.get('current_workers', 0)}/{metrics.get('max_workers', 0)} | Running: {metrics.get('running_count', 0)}")
                print(f"   EMA RPS: {metrics.get('ema_rps', 0):.2f} | Aged Jobs: {metrics.get('total_aged', 0)}")
                print(f"   Completed: {metrics.get('total_completed', 0)} | Failed: {metrics.get('total_failed', 0)}")
                response.success()
            else:
                response.failure(f"HTTP {response.status_code}")


# ============================================================
# 테스트 이벤트 핸들러
# ============================================================

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """테스트 시작 시 설정 출력"""
    print("\n" + "=" * 60)
    print("🚀 Sandbox Load Test Started")
    print("=" * 60)
    print(f"Target Host: {environment.host}")
    print(f"Tenant Count: {TENANT_COUNT}")
    print(f"Task Weights: Fast={FAST_WEIGHT}, Slow={SLOW_WEIGHT}, Heavy={HEAVY_WEIGHT}")
    print(f"FIFO Mode: {os.getenv('SANDBOX_FORCE_FIFO', 'false')}")
    print("=" * 60 + "\n")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """테스트 종료 시 요약 출력"""
    print("\n" + "=" * 60)
    print("✅ Sandbox Load Test Completed")
    print("=" * 60)
    
    stats = environment.stats
    
    # 주요 엔드포인트별 통계
    for name in ["[FAST] Simple Calc (manual)", "[SLOW] Sleep 1.5s (schedule)", "[HEAVY] Memory Alloc (api)"]:
        entry = stats.get(name, "POST")
        if entry:
            print(f"\n{name}:")
            print(f"   Requests: {entry.num_requests} | Failures: {entry.num_failures}")
            print(f"   Avg: {entry.avg_response_time:.0f}ms | P50: {entry.get_response_time_percentile(0.50):.0f}ms | P95: {entry.get_response_time_percentile(0.95):.0f}ms | P99: {entry.get_response_time_percentile(0.99):.0f}ms")
    
    print("\n" + "=" * 60)


# ============================================================
# CLI로 직접 실행 시 (디버깅용)
# ============================================================

if __name__ == "__main__":
    import subprocess
    import sys
    
    print("Locust를 직접 실행하세요:")
    print(f"  locust -f {__file__} --host=http://localhost:8001")
    print("\n옵션:")
    print("  --headless -u 30 -r 5 -t 2m  # 헤드리스 모드, 30명, 5명/초, 2분")
    print("  --csv=results/test           # CSV 결과 저장")
    print("  --tags fast                  # fast 태그만 실행")
