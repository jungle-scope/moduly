import argparse
import datetime
import os
import subprocess
import sys
import time
import threading
import json
from pathlib import Path

# 필수 패키지 임포트 시도
try:
    import psutil
    import pandas as pd
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
except ImportError as e:
    print(f"❌ 오류: {e}")
    print("이 스크립트를 실행하려면 'psutil', 'pandas', 'matplotlib' 패키지가 필요합니다.")
    print("설치 명령어: pip install psutil pandas matplotlib")
    sys.exit(1)

# 기본 설정값
DEFAULT_HOST = "http://localhost:8000"
DEFAULT_USERS = 10
DEFAULT_SPAWN_RATE = 2
DEFAULT_RUN_TIME = "30s"
HISTORY_FILE = Path(__file__).parent / "HISTORY.md"
REPORTS_DIR = Path(__file__).parent / "reports"

def get_server_pid(port=8000):
    """지정된 포트에서 리스닝 중인 프로세스의 PID를 찾습니다."""
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            for conn in proc.connections():
                if conn.laddr.port == port and conn.status == psutil.CONN_LISTEN:
                    return proc.pid
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return None

class ResourceMonitor:
    def __init__(self, pid, interval=1.0):
        self.pid = pid
        self.interval = interval
        self.stop_event = threading.Event()
        self.data = []
        self.process = psutil.Process(pid)

    def start(self):
        """별도 스레드에서 모니터링을 시작합니다."""
        self.thread = threading.Thread(target=self._monitor_loop)
        self.thread.start()

    def stop(self):
        """모니터링을 중단하고 스레드가 종료될 때까지 대기합니다."""
        self.stop_event.set()
        self.thread.join()

    def _monitor_loop(self):
        """주기적으로 CPU 및 메모리 사용량을 수집하는 루프"""
        while not self.stop_event.is_set():
            try:
                with self.process.oneshot():
                    cpu_percent = self.process.cpu_percent()
                    # 메모리 사용량 (RSS)를 MB 단위로 변환
                    memory_mb = self.process.memory_info().rss / 1024 / 1024
                    
                self.data.append({
                    "timestamp": datetime.datetime.now(),
                    "cpu_percent": cpu_percent,
                    "memory_mb": memory_mb
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                print("⚠️ 서버 프로세스가 종료되었거나 접근할 수 없습니다.")
                break
            
            time.sleep(self.interval)

def run_locust(host, users, spawn_rate, run_time, csv_prefix):
    """Locust를 헤드리스(Headless) 모드로 실행하여 부하를 생성합니다."""
    locustfile = Path(__file__).parent / "locustfile.py"
    cmd = [
        "locust",
        "-f", str(locustfile),
        "--headless",
        "--host", host,
        "--users", str(users),
        "--spawn-rate", str(spawn_rate),
        "--run-time", run_time,
        "--csv", str(csv_prefix)
    ]
    
    print(f"🚀 Locust 실행 중: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ Locust 실행 실패:")
        print(result.stderr)
    return result

def ensure_history_file():
    """HISTORY.md 파일이 없으면 상단 헤더와 함께 생성합니다."""
    if not HISTORY_FILE.exists():
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            f.write("# 부하 테스트 히스토리\n\n")
            f.write("| Date | Tag | Users | Duration | RPS | Avg Latency (ms) | Avg CPU (%) | Max CPU (%) | Avg Mem (MB) | Max Mem (MB) | Report |\n")
            f.write("|---|---|---|---|---|---|---|---|---|---|---|\n")

def generate_report_and_update_history(tag, monitor_data, locust_stats_csv, timestamp_str):
    """테스트 결과를 처리하여 그래프를 그리고, HISTORY.md에 요약을 기록합니다."""
    
    # 1. Locust 통계 처리
    try:
        df_stats = pd.read_csv(locust_stats_csv)
        # Locust 통계 파일은 각 요청별 통계와 'Aggregated' 행을 포함합니다.
        # 최신 Locust 버전에 따라 'Name' 컬럼이 'Aggregated'인 행을 찾습니다.
        total_row = df_stats[df_stats["Name"] == "Aggregated"]
        if total_row.empty:
             total_row = df_stats.iloc[-1:] # 찾지 못한 경우 마지막 행 사용

        rps = total_row["Requests/s"].values[0]
        avg_latency = total_row["Average Response Time"].values[0]
    except Exception as e:
        print(f"⚠️ Locust CSV 파싱 실패: {e}")
        rps = 0
        avg_latency = 0

    # 2. 모니터링 데이터 처리 및 시각화
    if monitor_data:
        df_res = pd.DataFrame(monitor_data)
        avg_cpu = df_res["cpu_percent"].mean()
        max_cpu = df_res["cpu_percent"].max()
        avg_mem = df_res["memory_mb"].mean()
        max_mem = df_res["memory_mb"].max()
        
        # 그래프 생성
        plt.figure(figsize=(10, 6))
        
        # CPU 그래프
        ax1 = plt.subplot(2, 1, 1)
        plt.plot(df_res["timestamp"], df_res["cpu_percent"], 'b-', label='CPU %')
        plt.title(f"Make it Heavy - Resource Usage ({tag})")
        plt.ylabel("CPU %")
        plt.grid(True)
        plt.legend()
        
        # Memory 그래프
        ax2 = plt.subplot(2, 1, 2, sharex=ax1)
        plt.plot(df_res["timestamp"], df_res["memory_mb"], 'r-', label='Memory (MB)')
        plt.ylabel("Memory (MB)")
        plt.xlabel("Time")
        plt.grid(True)
        plt.legend()

        # X축 시간 포맷 설정
        plt.gcf().autofmt_xdate()
        myFmt = mdates.DateFormatter('%H:%M:%S')
        ax2.xaxis.set_major_formatter(myFmt)

        report_img_path = REPORTS_DIR / timestamp_str / "resources.png"
        plt.savefig(report_img_path)
        plt.close()
    else:
        avg_cpu = max_cpu = avg_mem = max_mem = 0

    # 3. 히스토리 기록 추가
    ensure_history_file()
    
    date_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    report_link = f"[Link](reports/{timestamp_str}/)"
    
    line = f"| {date_str} | {tag} | {args.users} | {args.run_time} | {rps:.2f} | {avg_latency:.2f} | {avg_cpu:.1f} | {max_cpu:.1f} | {avg_mem:.1f} | {max_mem:.1f} | {report_link} |\n"
    
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(line)
        
    print(f"\n✅ 결과가 HISTORY.md 및 reports/{timestamp_str}/ 에 저장되었습니다.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="부하 테스트 실행 및 이력 기록")
    parser.add_argument("--tag", default="v0.0.1", help="시스템 버전 태그 또는 코멘트")
    parser.add_argument("--users", type=int, default=DEFAULT_USERS, help="동시 사용자 수")
    parser.add_argument("--spawn-rate", type=int, default=DEFAULT_SPAWN_RATE, help="사용자 증가 속도 (명/초)")
    parser.add_argument("--run-time", default=DEFAULT_RUN_TIME, help="테스트 실행 시간 (예: 30s, 1m)")
    parser.add_argument("--host", default=DEFAULT_HOST, help="대상 호스트 주소")
    parser.add_argument("--pid", type=int, help="대상 서버 프로세스 ID (선택사항, 미지정 시 8000포트에서 자동 감지)")
    
    args = parser.parse_args()

    # 리포트 디렉토리 생성
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    current_report_dir = REPORTS_DIR / timestamp_str
    current_report_dir.mkdir(parents=True, exist_ok=True)

    # 1. 서버 프로세스 감지
    pid = args.pid
    if not pid:
        # 호스트 주소에서 포트 파싱
        try:
            port = int(args.host.split(":")[-1])
        except:
            port = 8000
            
        pid = get_server_pid(port)
        
    if not pid:
        print(f"⚠️ 포트 {port}에서 서버 프로세스를 찾을 수 없습니다. CPU/Memory 모니터링은 건너뜁니다.")
    else:
        print(f"🔎 서버 프로세스 ID 발견: {pid}")

    # 2. 모니터링 시작
    monitor = None
    if pid:
        monitor = ResourceMonitor(pid)
        monitor.start()

    # 3. Locust 실행
    csv_prefix = current_report_dir / "locust_stats"
    try:
        run_locust(args.host, args.users, args.spawn_rate, args.run_time, csv_prefix)
    except KeyboardInterrupt:
        print("\n🛑 사용자에 의해 중단됨")
    finally:
        # 4. 모니터링 종료
        if monitor:
            monitor.stop()

    # 5. 결과 처리
    print("\n📊 결과 처리 중...")
    # csv_prefix 뒤에 _stats.csv가 붙은 파일이 생성됩니다.
    stats_file = current_report_dir / "locust_stats_stats.csv"
    if stats_file.exists():
        generate_report_and_update_history(args.tag, monitor.data if monitor else [], stats_file, timestamp_str)
    else:
        print("❌ Locust 통계 파일을 찾을 수 없습니다. Locust가 정상적으로 실행되었나요?")
