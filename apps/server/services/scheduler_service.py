"""Scheduler Service - APScheduler를 사용한 워크플로우 스케줄 관리"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session

from apps.shared.db.models.schedule import Schedule
from apps.shared.db.models.workflow_deployment import WorkflowDeployment


class SchedulerService:
    """
    워크플로우 스케줄을 관리하는 서비스

    동작 방식:
    1. 서버 시작 시: load_schedules_from_db() 호출 → DB에서 활성 스케줄 로드
    2. 배포 생성 시: add_schedule() 호출 → 새 스케줄 등록
    3. APScheduler가 지정된 시간에 _run_workflow() 자동 호출
    4. 서버 재시작해도 DB에서 스케줄 복구
    """

    def __init__(self):
        """BackgroundScheduler 초기화"""
        self.scheduler = BackgroundScheduler(timezone="UTC")
        self.scheduler.start()
        print("[SchedulerService] APScheduler 시작됨")

    def load_schedules_from_db(self, db: Session):
        """
        서버 시작 시 DB에서 모든 스케줄을 로드하여 메모리에 등록
        활성 배포(is_active=True)의 스케줄만 로드합니다.

        Args:
            db: 데이터베이스 세션
        """
        # 활성 배포만 필터링
        schedules = (
            db.query(Schedule)
            .join(WorkflowDeployment, Schedule.deployment_id == WorkflowDeployment.id)
            .filter(WorkflowDeployment.is_active.is_(True))
            .all()
        )

        for schedule in schedules:
            try:
                self.add_schedule(schedule, db)
            except Exception as e:
                print(f"  ✗ 스케줄 로드 실패 ({schedule.id}): {e}")

        print("[SchedulerService] 스케줄 로드 완료")

    def add_schedule(self, schedule: Schedule, db: Session):
        """
        새 스케줄을 APScheduler에 등록

        Args:
            schedule: Schedule 모델 인스턴스
            db: 데이터베이스 세션 (next_run_at 업데이트용, job 실행에는 사용되지 않음)

        Note:
            APScheduler job은 별도 스레드에서 실행되므로, job 실행 시에는
            _run_workflow 내부에서 새 DB 세션을 생성합니다.
        """
        job_id = str(schedule.id)

        # Cron 트리거 생성
        trigger = CronTrigger.from_crontab(
            schedule.cron_expression, timezone=schedule.timezone
        )

        # Job 등록 (db 세션은 전달하지 않음 - 스레드 안전성 문제)
        self.scheduler.add_job(
            func=self._run_workflow,
            trigger=trigger,
            id=job_id,
            name=f"Schedule: {schedule.cron_expression}",
            args=[schedule.deployment_id, schedule.id],  # db 제거
            replace_existing=True,  # 같은 ID면 교체
        )

        # 다음 실행 시간 계산 및 DB 업데이트
        job = self.scheduler.get_job(job_id)
        if job and job.next_run_time:
            schedule.next_run_at = job.next_run_time
            db.commit()

        print(
            f"[SchedulerService] Job 등록: {job_id} | 다음 실행: {schedule.next_run_at}"
        )

    def remove_schedule(self, schedule_id: uuid.UUID):
        """
        스케줄을 APScheduler에서 제거

        Args:
            schedule_id: Schedule ID
        """
        job_id = str(schedule_id)

        try:
            self.scheduler.remove_job(job_id)
            print(f"[SchedulerService] Job 제거: {job_id}")
        except Exception as e:
            print(f"[SchedulerService] Job 제거 실패 ({job_id}): {e}")

    def update_schedule(
        self,
        schedule: Schedule,
        db: Session,
    ):
        """
        스케줄 정보 업데이트 (Cron 표현식 또는 타임존 변경 시)

        Args:
            schedule: 업데이트된 Schedule 모델
            db: 데이터베이스 세션
        """
        # 기존 Job 제거 후 다시 등록
        self.remove_schedule(schedule.id)
        self.add_schedule(schedule, db)

    def _run_workflow(
        self,
        deployment_id: uuid.UUID,
        schedule_id: uuid.UUID,
    ):
        """
        스케줄된 시간에 워크플로우를 실행하는 실제 함수

        Args:
            deployment_id: 배포 ID
            schedule_id: 스케줄 ID

        Note:
            이 함수는 APScheduler가 별도 스레드에서 호출합니다.
            SQLAlchemy 세션은 스레드 안전하지 않으므로, 각 job 실행 시
            새로운 DB 세션을 생성하여 사용합니다.
        """
        # 각 job 실행마다 새로운 DB 세션 생성 (스레드 안전성 보장)
        from apps.shared.db.session import SessionLocal

        db = SessionLocal()
        triggered_at = datetime.now(timezone.utc).isoformat()

        print(
            f"[SchedulerService] 워크플로우 실행 시작: {deployment_id} (스케줄: {schedule_id})"
        )

        try:
            # Deployment 조회
            deployment = (
                db.query(WorkflowDeployment)
                .filter(WorkflowDeployment.id == deployment_id)
                .first()
            )

            if not deployment:
                print(f"[SchedulerService] 에러: Deployment 없음: {deployment_id}")
                return

            if not deployment.is_active:
                print(
                    f"[SchedulerService] 에러: Deployment 비활성화됨: {deployment_id}"
                )
                return

            # WorkflowEngine 실행 (AsyncIO 이벤트 루프에서)
            # Note: BackgroundScheduler는 별도 스레드에서 실행되므로
            # asyncio 이벤트 루프를 직접 생성해야 함
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # WorkflowEngine import (순환 의존성 방지)
                from workflow.core.workflow_engine import WorkflowEngine

                # user_input에 스케줄 메타데이터 포함
                user_input = {
                    "triggered_at": triggered_at,
                    "schedule_id": str(schedule_id),
                }

                engine = WorkflowEngine(
                    graph=deployment.graph_snapshot,
                    user_input=user_input,
                    execution_context={
                        "user_id": deployment.created_by,
                        "workflow_id": deployment.app_id,
                    },
                    is_deployed=True,
                    db=db,
                )

                # 비동기 실행
                result = loop.run_until_complete(engine.execute())

                print(f"[SchedulerService] 완료: 워크플로우 실행 성공: {deployment_id}")

                # Schedule 업데이트: last_run_at, next_run_at
                schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
                if schedule:
                    schedule.last_run_at = datetime.now(timezone.utc)

                    # 다음 실행 시간 계산
                    job = self.scheduler.get_job(str(schedule_id))
                    if job and job.next_run_time:
                        schedule.next_run_at = job.next_run_time

                    db.commit()

            finally:
                loop.close()

        except Exception as e:
            print(f"[SchedulerService] 에러: 워크플로우 실행 실패: {e}")
            import traceback

            traceback.print_exc()
            # 예외 발생 시 rollback
            db.rollback()

        finally:
            # 세션 반드시 닫기 (커넥션 풀 반환)
            db.close()

    def shutdown(self):
        """Scheduler 종료 (서버 종료 시 호출)"""
        self.scheduler.shutdown()
        print("[SchedulerService] APScheduler 종료됨")


# 글로벌 SchedulerService 인스턴스 (서버 시작 시 초기화)
scheduler_service: Optional[SchedulerService] = None


def get_scheduler_service() -> SchedulerService:
    """
    글로벌 SchedulerService 인스턴스 반환

    Returns:
        SchedulerService 인스턴스

    Raises:
        RuntimeError: 서버 시작 전에 호출된 경우
    """
    global scheduler_service
    if scheduler_service is None:
        raise RuntimeError(
            "SchedulerService가 초기화되지 않았습니다. "
            "서버 시작 시 init_scheduler_service()를 호출하세요."
        )
    return scheduler_service


def init_scheduler_service(db: Session) -> SchedulerService:
    """
    서버 시작 시 SchedulerService 초기화 (main.py에서 호출)

    Args:
        db: 데이터베이스 세션

    Returns:
        초기화된 SchedulerService 인스턴스
    """
    global scheduler_service
    scheduler_service = SchedulerService()
    scheduler_service.load_schedules_from_db(db)
    return scheduler_service
