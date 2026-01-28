#!/usr/bin/env python3
"""
Redis Queue 실시간 모니터링 스크립트
- Redis Queue 길이 변동 실시간 확인
- 결과 파일(redis_task_count.md) 자동 저장
- 에러 상세 출력 모드 추가
"""

import os
import subprocess
import sys
import time
from datetime import datetime

# 설정
OUTPUT_FILE = "redis_task_count_user100.md"
REDIS_PASSWORD = "moduly-redis-pass-2026"
INTERVAL = 2


def get_redis_pod_name():
    """Redis Master Pod 이름을 동적으로 찾습니다."""
    print("🔎 Searching for Redis Pod...")

    # 1. StatefulSet 이름 (가장 유력)
    common_names = ["moduly-redis-master-0", "redis-master-0"]
    for name in common_names:
        cmd = ["kubectl", "get", "pod", "-n", "default", name, "--no-headers"]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
            if res.returncode == 0:
                return name
        except Exception:
            pass

    # 2. 'redis'와 'master'가 포함된 Pod 검색
    cmd = [
        "kubectl",
        "get",
        "pods",
        "-n",
        "default",
        "--no-headers",
        "-o",
        "custom-columns=:metadata.name",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        for line in result.stdout.splitlines():
            name = line.strip()
            # master가 있거나, redis가 있는데 exporter나 worker가 아닌 것
            if "master" in name and "redis" in name:
                return name
            if "redis" in name and "exporter" not in name and "worker" not in name:
                # master라는 단어가 없을 수도 있으니 후보로 둠
                return name
    except Exception as e:
        print(f"❌ Error searching pods: {e}")

    return None


def get_queue_length(pod_name, queue_name):
    """Redis CLI로 queue 길이를 조회합니다."""
    if not pod_name:
        return -1

    cmd = [
        "kubectl",
        "exec",
        "-n",
        "default",
        pod_name,
        "--",
        "redis-cli",
        "-a",
        REDIS_PASSWORD,
        "--no-auth-warning",
        "LLEN",
        queue_name,
    ]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, encoding="utf-8"
        )

        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            last_line = lines[-1].strip()

            if "(integer)" in last_line:
                return int(last_line.split()[-1])
            try:
                return int(last_line)
            except ValueError:
                print(f"\n⚠️ Parsing error: {last_line}")
                return -1
        else:
            # 에러 메시지 빨간색으로 출력
            err_msg = result.stderr.strip()
            print(f"\n❌ Exec Error ({queue_name}): {err_msg}")
            return -1

    except Exception as e:
        print(f"\n❌ System Error: {e}")
        return -1


def get_worker_count():
    """현재 실행 중인 Worker Pod 개수"""
    cmd = [
        "kubectl",
        "get",
        "pods",
        "-n",
        "default",
        "-l",
        "app=worker",
        "--no-headers",
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=5, encoding="utf-8"
        )
        if result.returncode == 0:
            return len(result.stdout.strip().splitlines())
    except Exception:
        pass
    return -1


def init_log_file():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("# Redis Task Queue Log\n\n")
        f.write(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("| Time | Workflow | Log | Total | Workers |\n")
        f.write("|:-:|:-:|:-:|:-:|:-:|\n")
    print(f"📝 Logging to {os.path.abspath(OUTPUT_FILE)}")


def main():
    print("=" * 60)
    print("🚀 Redis Queue Monitor Started")
    print("=" * 60)

    # 1. Redis Pod 찾기
    print("� Finding Redis Master Pod...")
    redis_pod = get_redis_pod_name()
    if not redis_pod:
        print("❌ FAILED: Could not find Redis Master Pod.")
        return
    print(f"✅ Target Pod: {redis_pod}")
    print("-" * 60)

    # 2. 파일 초기화
    init_log_file()

    try:
        while True:
            now = datetime.now().strftime("%H:%M:%S")

            # 데이터 수집 (Workflow Queue만)
            wf_len = get_queue_length(redis_pod, "workflow")
            workers = get_worker_count()

            # 포맷팅
            wf_str = "ERR" if wf_len == -1 else str(wf_len)

            # 콘솔 출력
            print(f"[{now}] 📊 Workflow Queue: {wf_str:>5} | 👷 Workers: {workers}")

            # 파일 저장
            with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
                f.write(f"| {now} | {wf_str} | - | {wf_str} | {workers} |\n")

            sys.stdout.flush()
            time.sleep(INTERVAL)

    except KeyboardInterrupt:
        print("\n🛑 Stopped.")


if __name__ == "__main__":
    main()
