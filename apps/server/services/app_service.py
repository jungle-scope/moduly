from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow import Workflow
from schemas.app import AppCreateRequest


class AppService:
    @staticmethod
    def create_app(
        db: Session,
        request: AppCreateRequest,
        user_id: str = "default-user",
        tenant_id: str = "default-tenant",
    ):
        """
        새로운 앱을 생성합니다.

        Args:
            db: 데이터베이스 세션
            request: 앱 생성 요청 데이터
            user_id: 생성자 ID
            tenant_id: 테넌트 ID

        Returns:
            생성된 App 객체
        """
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
    def list_apps(db: Session, tenant_id: str = "default-tenant"):
        """테넌트의 모든 앱을 조회합니다."""
        return db.query(App).filter(App.tenant_id == tenant_id).all()
