from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow import Workflow
from schemas.app import AppCreateRequest


class AppService:
    @staticmethod
    def create_app(
        db: Session,
        request: AppCreateRequest,
        user_id: str,
        tenant_id: str = None,
    ):
        """
        새로운 앱을 생성합니다.

        Args:
            db: 데이터베이스 세션
            request: 앱 생성 요청 데이터
            user_id: 생성자 ID (필수)
            tenant_id: 테넌트 ID (선택, 기본값은 user_id)

        Returns:
            생성된 App 객체
        """
        # tenant_id가 없으면 user_id를 사용 (유저별 분리)
        if not tenant_id:
            tenant_id = user_id

        app = App(
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            icon=request.icon,
            icon_background=request.icon_background,
            created_by=user_id,
        )
        db.add(app)
        db.flush()  # App ID 생성

        # 2. 기본 워크플로우 생성
        workflow = Workflow(
            tenant_id=tenant_id,
            app_id=app.id,
            created_by=user_id,
        )
        db.add(workflow)
        db.flush()  # Workflow ID 생성

        # 3. 앱에 워크플로우 ID 연결
        app.workflow_id = workflow.id

        db.add(app)
        db.commit()
        db.refresh(app)

        print(f"✅ App created: {app.name} (ID: {app.id})")

        return app

    @staticmethod
    def get_app(db: Session, app_id: str):
        """앱을 ID로 조회합니다."""
        return db.query(App).filter(App.id == app_id).first()

    @staticmethod
    def list_apps(db: Session, user_id: str):
        """해당 유저가 만든 앱만 조회합니다."""
        return db.query(App).filter(App.created_by == user_id).all()
