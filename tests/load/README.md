# Moduly Server 부하 테스트 자동화

이 디렉토리는 Moduly 서버 엔진의 성능을 주기적으로 측정하고 추적하기 위한 도구들을 포함하고 있습니다.
Locust를 기반으로 하며, 시스템 리소스(CPU, Memory) 모니터링 기능을 통합하여 구현되었습니다.

## 사전 준비 (Dependencies)

테스트 스크립트를 실행하기 위해 아래 Python 패키지들이 필요합니다.

```bash
pip install locust psutil pandas matplotlib
```

또한 환경 변수 설정이 필요합니다 (`.env`).

```
LOAD_TEST_DEPLOYMENT_SLUG=your-test-slug
LOAD_TEST_AUTH_TOKEN=your-secret-token
```

## 사용 방법

서버(`uvicorn`)를 실행해 둔 상태에서, 새 터미널을 열고 아래 명령어를 실행하세요.

```bash
# 기본 실행 (10명 유저, 30초 수행, 태그: v0.0.1)
python apps/server/tests/load/run_benchmark.py --tag "Initial_Base"

# 옵션 지정 사용자 정의
python apps/server/tests/load/run_benchmark.py \
    --users 50 \
    --spawn-rate 5 \
    --run-time 1m \
    --tag "Engine_Optimization_v2"
```

### 주요 옵션

- `--tag`: 해당 테스트의 이름이나 버전 (HISTORY.md에 기록됨)
- `--users`: 동시 접속 사용자 수
- `--run-time`: 테스트 지속 시간 (예: 30s, 1m, 10m)
- `--host`: 대상 서버 주소 (기본: http://localhost:8000)

## 결과 확인

1. **테스트 완료 후**:

   - `HISTORY.md` 파일 맨 아래에 새로운 테스트 결과 한 줄이 추가됩니다.
   - `reports/YYYYMMDD_HHMMSS/` 폴더에 상세 리포트가 생성됩니다.
     - `resources.png`: 시간에 따른 CPU 및 메모리 사용량 그래프
     - `locust_stats_stats.csv`: Locust가 생성한 상세 통계 CSV

2. **HISTORY.md 예시**:

| Date             | Tag    | Users | Duration | RPS  | Avg Latency (ms) | Avg CPU (%) | Avg Mem (MB) | Report              |
| ---------------- | ------ | ----- | -------- | ---- | ---------------- | ----------- | ------------ | ------------------- |
| 2026-01-13 15:30 | v0.1.0 | 10    | 30s      | 45.2 | 120.5            | 15.4        | 102.5        | [Link](reports/...) |

## 주의사항

- **정확한 CPU/Mem 측정을 위해**: 로컬에서 테스트 시 테스트 서버와 부하 생성기(Locust)가 같은 머신에 있으면 자원 경쟁이 있을 수 있습니다. 가능하면 분리하거나, 충분한 사양의 머신에서 수행하세요.
- **Server PID 감지**: 스크립트는 포트 8000을 사용하는 프로세스를 자동으로 찾아 모니터링합니다. 다른 포트를 사용한다면 `--host`에 포트를 명시하거나 직접 PID를 줄 수 있습니다 (PID 기능은 코드 확인 필요).
