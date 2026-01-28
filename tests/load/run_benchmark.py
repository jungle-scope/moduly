import argparse
import datetime
import subprocess
import sys
import time
from pathlib import Path

# 필수 패키지 임포트 시도
try:
    import pandas as pd
except ImportError as e:
    print(f"❌ 오류: {e}")
    print("이 스크립트를 실행하려면 'pandas' 패키지가 필요합니다.")
    print("설치 명령어: pip install pandas")
    sys.exit(1)

# 기본 설정값
DEFAULT_HOST = "https://moduly-ai.cloud"
DEFAULT_USERS = 50
DEFAULT_SPAWN_RATE = 5
DEFAULT_RUN_TIME = "40s"
DEFAULT_DELAY = 40  # 테스트 사이 대기 시간 (초)
DEFAULT_LOCUSTFILES = ["load1.py", "load2.py", "load3.py"]
HISTORY_FILE = Path(__file__).parent / "HISTORY.md"
REPORTS_DIR = Path(__file__).parent / "reports"


def run_locust(host, users, spawn_rate, run_time, csv_prefix, locustfile):
    """Locust를 헤드리스(Headless) 모드로 실행하여 부하를 생성합니다."""
    cmd = [
        "python",
        "-m",
        "locust",
        "-f",
        str(locustfile),
        "--headless",
        "--host",
        host,
        "--users",
        str(users),
        "--spawn-rate",
        str(spawn_rate),
        "--run-time",
        run_time,
        "--csv",
        str(csv_prefix),
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
            f.write(
                "| Date | Tag | Test | Users | Duration | RPS | Avg Latency (ms) | Report |\n"
            )
            f.write("|---|---|---|---|---|---|---|---|\n")


def parse_locust_stats(locust_stats_csv):
    """Locust 통계 CSV 파일을 파싱하여 RPS와 평균 레이턴시를 반환합니다."""
    try:
        df_stats = pd.read_csv(locust_stats_csv)
        total_row = df_stats[df_stats["Name"] == "Aggregated"]
        if total_row.empty:
            total_row = df_stats.iloc[-1:]

        rps = total_row["Requests/s"].values[0]
        avg_latency = total_row["Average Response Time"].values[0]
        return rps, avg_latency
    except Exception as e:
        print(f"⚠️ Locust CSV 파싱 실패: {e}")
        return 0, 0


def append_to_history(
    date_str, tag, test_name, users, run_time, rps, avg_latency, report_link
):
    """HISTORY.md에 한 줄을 추가합니다."""
    ensure_history_file()
    line = f"| {date_str} | {tag} | {test_name} | {users} | {run_time} | {rps:.2f} | {avg_latency:.2f} | {report_link} |\n"
    with open(HISTORY_FILE, "a", encoding="utf-8") as f:
        f.write(line)


def run_all_tests(args, locustfiles, timestamp_str, current_report_dir):
    """모든 테스트를 순차적으로 실행하고 결과를 기록합니다."""
    date_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    results = []

    for i, locustfile_name in enumerate(locustfiles, 1):
        locustfile = Path(__file__).parent / locustfile_name
        test_name = locustfile.stem  # 확장자 제외한 파일명 (예: load1)

        if not locustfile.exists():
            print(f"⚠️ Locust 파일을 찾을 수 없습니다: {locustfile}")
            continue

        print(f"\n{'=' * 60}")
        print(f"📋 테스트 {i}/{len(locustfiles)}: {test_name}")
        print(f"{'=' * 60}")

        # 각 테스트별 CSV prefix 설정
        csv_prefix = current_report_dir / f"{test_name}_stats"

        try:
            run_locust(
                args.host,
                args.users,
                args.spawn_rate,
                args.run_time,
                csv_prefix,
                locustfile,
            )
        except KeyboardInterrupt:
            print("\n🛑 사용자에 의해 중단됨")
            break

        # 결과 파싱 및 기록
        stats_file = current_report_dir / f"{test_name}_stats_stats.csv"
        if stats_file.exists():
            rps, avg_latency = parse_locust_stats(stats_file)
            report_link = f"[Link](reports/{timestamp_str}/)"
            append_to_history(
                date_str,
                args.tag,
                test_name,
                args.users,
                args.run_time,
                rps,
                avg_latency,
                report_link,
            )
            results.append((test_name, rps, avg_latency))
            print(
                f"✅ {test_name} 완료 - RPS: {rps:.2f}, Avg Latency: {avg_latency:.2f}ms"
            )
        else:
            print(f"❌ {test_name} 통계 파일을 찾을 수 없습니다.")

        # 마지막 테스트가 아니면 대기
        if i < len(locustfiles):
            print(f"\n⏳ 서버 안정화를 위해 {args.delay}초 대기 중...")
            time.sleep(args.delay)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="부하 테스트 실행 및 이력 기록")
    parser.add_argument("--tag", default="v0.0.1", help="시스템 버전 태그 또는 코멘트")
    parser.add_argument(
        "--users", type=int, default=DEFAULT_USERS, help="동시 사용자 수"
    )
    parser.add_argument(
        "--spawn-rate",
        type=int,
        default=DEFAULT_SPAWN_RATE,
        help="사용자 증가 속도 (명/초)",
    )
    parser.add_argument(
        "--run-time", default=DEFAULT_RUN_TIME, help="테스트 실행 시간 (예: 30s, 1m)"
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help="대상 호스트 주소")
    parser.add_argument(
        "--delay",
        type=int,
        default=DEFAULT_DELAY,
        help="테스트 사이 대기 시간 (초, 기본값: 40)",
    )
    parser.add_argument(
        "--locustfiles",
        nargs="+",
        default=DEFAULT_LOCUSTFILES,
        help="실행할 locust 파일 목록 (기본값: load1.py load2.py load3.py)",
    )

    args = parser.parse_args()

    # 리포트 디렉토리 생성
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    current_report_dir = REPORTS_DIR / timestamp_str
    current_report_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'=' * 60}")
    print("🎯 부하 테스트 시작")
    print(f"{'=' * 60}")
    print(f"📍 대상: {args.host}")
    print(f"👥 사용자: {args.users}명")
    print(f"⏱️  실행 시간: {args.run_time}")
    print(f"⏸️  테스트 간 대기: {args.delay}초")
    print(f"📝 테스트: {', '.join(args.locustfiles)}")
    print(f"🏷️  태그: {args.tag}")

    # 모든 테스트 실행
    results = run_all_tests(args, args.locustfiles, timestamp_str, current_report_dir)

    # 최종 결과 요약
    print(f"\n{'=' * 60}")
    print("📊 테스트 결과 요약")
    print(f"{'=' * 60}")
    for test_name, rps, avg_latency in results:
        print(f"  {test_name}: RPS={rps:.2f}, Avg Latency={avg_latency:.2f}ms")
    print(f"\n✅ 결과가 HISTORY.md 및 reports/{timestamp_str}/ 에 저장되었습니다.")
