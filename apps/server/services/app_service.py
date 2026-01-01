from sqlalchemy.orm import Session

from db.models.app import App
from db.models.workflow import Workflow
from schemas.app import AppCreateRequest, AppUpdateRequest


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
            is_public=request.is_public,
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
    def update_app(
        db: Session,
        app_id: str,
        request: AppUpdateRequest,
        user_id: str,
    ):
        """
        앱 정보를 수정합니다.
        """
        app = db.query(App).filter(App.id == app_id).first()
        if not app:
            return None

        # 생성자만 수정 가능
        if app.created_by != user_id:
            return None

        # 변경된 필드만 업데이트
        update_data = request.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(app, key, value)

        db.add(app)
        db.commit()
        db.refresh(app)
        
        return app

    @staticmethod
    def get_app(db: Session, app_id: str):
        """앱을 ID로 조회합니다."""
        return db.query(App).filter(App.id == app_id).first()

    @staticmethod
    def list_apps(db: Session, user_id: str):
        """해당 유저가 만든 앱만 조회합니다."""
        return db.query(App).filter(App.created_by == user_id).all()

    @staticmethod
    def list_explore_apps(db: Session, user_id: str):
        """공개된 앱 중 본인이 만든 앱을 제외하고 조회합니다."""
        return (
            db.query(App)
            .filter(App.is_public == True, App.created_by != user_id)
            .all()
        )

    @staticmethod
    def clone_app(db: Session, user_id: str, app_id: str):
        """
        앱을 복제합니다 (워크플로우 포함).
        """
        # 1. 원본 앱 조회
        source_app = db.query(App).filter(App.id == app_id).first()
        if not source_app:
            return None

        # 2. 원본 워크플로우 조회
        source_workflow = (
            db.query(Workflow).filter(Workflow.id == source_app.workflow_id).first()
        )

        if not source_workflow:
            # 워크플로우가 없는 경우 (예외적 상황), 기본 생성 로직 등 처리 필요하지만
            # 여기서는 단순히 None 리턴하거나 에러 처리.
            # 하지만 앱 생성시 무조건 워크플로우가 생성되므로 있다고 가정.
            return None

        # 3. 앱 복제 (새로운 객체 생성)
        # 이름은 "Copy of {source_name}" 등으로 할 수도 있지만, 일단 원본 이름 그대로 사용
        new_app = App(
            tenant_id=user_id,  # 복제하는 사람의 tenant_id (user_id와 동일 가정)
            name=f"{source_app.name} (복사본)",
            description=source_app.description,
            icon=source_app.icon,
            icon_background=source_app.icon_background,
            created_by=user_id,
        )
        db.add(new_app)
        db.flush()

        # 4. 워크플로우 복제
        new_workflow = Workflow(
            tenant_id=user_id,
            app_id=new_app.id,
            created_by=user_id,
            # JSONB 필드 복사
            graph=source_workflow.graph,
            _features=source_workflow._features,
            _environment_variables=source_workflow._environment_variables,
            _conversation_variables=source_workflow._conversation_variables,
            _rag_pipeline_variables=source_workflow._rag_pipeline_variables,
            # 메타데이터
            version=source_workflow.version,
        )
        db.add(new_workflow)
        db.flush()

        # 5. 앱-워크플로우 연결
        new_app.workflow_id = new_workflow.id
        db.add(new_app)
        db.commit()
        db.refresh(new_app)

        return new_app

    @staticmethod
    def delete_app(db: Session, app_id: str, user_id: str):
        """
        앱을 삭제합니다.
        """
        app = db.query(App).filter(App.id == app_id).first()
        if not app:
            return None

        # 생성자만 삭제 가능
        if app.created_by != user_id:
            return None

        # 연결된 워크플로우도 삭제해야 함 (여기서는 단순히 앱만 삭제, DB FK 설정에 따라 다를 수 있음)
        # 만약 워크플로우가 앱에 종속적이라면 함께 삭제하는 것이 좋음.
        # 일단은 앱만 삭제.
        
        db.delete(app)
        db.commit()
        
        return True
