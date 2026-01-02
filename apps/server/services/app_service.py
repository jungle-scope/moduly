import copy
import secrets

from sqlalchemy.orm import Session, joinedload

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

        # url_slug, auth_secret 생성
        url_slug = AppService._generate_url_slug(db, request.name)
        auth_secret = f"sk-{secrets.token_hex(24)}"

        # App 생성
        app = App(
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            icon=request.icon.model_dump(),
            is_market=request.is_market,
            created_by=user_id,
            url_slug=url_slug,
            auth_secret=auth_secret,
        )
        db.add(app)
        db.flush()  # App ID 생성

        # 기본 워크플로우 생성
        workflow = Workflow(
            tenant_id=tenant_id,
            app_id=app.id,
            created_by=user_id,
        )
        db.add(workflow)
        db.flush()

        # App에 워크플로우 연결
        app.workflow_id = workflow.id

        db.commit()
        db.refresh(app)
        print(f"✅ App created: {app.name} (ID: {app.id})")

        return app

    @staticmethod
    def get_app(db: Session, app_id: str, user_id: str = None):
        """
        특정 앱을 조회합니다.

        Args:
            db: 데이터베이스 세션
            app_id: 앱 ID
            user_id: 요청 유저 ID (선택, 비공개 앱의 경우 소유자만 접근 가능)

        Returns:
            App 객체 또는 None
        """
        app = db.query(App).filter(App.id == app_id).first()

        if not app:
            return None

        # 소유자 체크
        if user_id and app.created_by != user_id:
            return None

        return app

    @staticmethod
    def get_user_apps(db: Session, user_id: str):
        """
        특정 유저의 모든 앱을 조회합니다.

        Args:
            db: 데이터베이스 세션
            user_id: 유저 ID

        Returns:
            App 객체 리스트
        """
        return (
            db.query(App)
            # N+1 문제 방지를 위해 active_deployment 관계를 즉시 로딩 (Joined Load)
            .options(joinedload(App.active_deployment))
            .filter(App.created_by == user_id)
            .all()
        )

    @staticmethod
    def list_explore_apps(db: Session, user_id: str):
        """
        마켓플레이스에 공개된 앱 목록을 조회합니다.

        Args:
            db: 데이터베이스 세션
            user_id: 현재 유저 ID (사용되지 않지만 일관성을 위해 유지)

        Returns:
            공개된 App 객체 리스트
        """
        return db.query(App).filter(App.is_market == True).all()

    @staticmethod
    def update_app(db: Session, app_id: str, request: AppUpdateRequest, user_id: str):
        """
        앱 정보를 수정합니다.

        Args:
            db: 데이터베이스 세션
            app_id: 앱 ID
            request: 앱 수정 요청 데이터
            user_id: 요청 유저 ID

        Returns:
            수정된 App 객체 또는 None
        """
        app = db.query(App).filter(App.id == app_id).first()
        if not app:
            return None

        # 생성자만 수정 가능
        if app.created_by != user_id:
            return None

        # 필드 업데이트
        if request.name is not None:
            app.name = request.name
        if request.description is not None:
            app.description = request.description
        if request.icon is not None:
            app.icon = request.icon.model_dump()
        if request.is_market is not None:
            # 복제된 앱은 마켓에 공개 불가
            if request.is_market and app.forked_from:
                print(f"❌ Cannot publish cloned app {app_id} to market")
                return None
            app.is_market = request.is_market

        db.commit()
        db.refresh(app)

        return app

    @staticmethod
    def clone_app(db: Session, source_app_id: str, user_id: str):
        """
        기존 앱을 복제합니다.
        """
        from db.models.workflow_deployment import WorkflowDeployment

        # 1. 원본 앱 조회
        source_app = db.query(App).filter(App.id == source_app_id).first()
        if not source_app:
            return None

        # 2. 활성 배포 확인 (Active Deployment)
        if not source_app.active_deployment_id:
            # 배포된 버전이 없으면 복제 불가 (에러 발생)
            raise ValueError("Cannot clone app without active deployment.")

        # 3. 배포 데이터 조회
        deployment = (
            db.query(WorkflowDeployment)
            .filter(WorkflowDeployment.id == source_app.active_deployment_id)
            .first()
        )

        if not deployment:
            raise ValueError("Active deployment data not found.")

        # 4. 앱 복제 (새로운 객체 생성)
        new_icon = copy.deepcopy(source_app.icon)

        # 마켓플레이스에서 복제할 때 url_slug와 auth_secret 생성
        new_slug = AppService._generate_url_slug(db, f"{source_app.name} (복사본)")
        new_secret = secrets.token_urlsafe(32)

        new_app = App(
            tenant_id=user_id,  # 복제하는 사람의 tenant_id (user_id와 동일 가정)
            name=f"{source_app.name} (복사본)",
            description=source_app.description,
            icon=new_icon,
            url_slug=new_slug,
            auth_secret=new_secret,
            forked_from=source_app_id,  # 원본 추적
            created_by=user_id,
            is_market=False,  # 복제된 앱은 기본적으로 비공개
        )
        db.add(new_app)
        db.flush()

        # 5. 워크플로우 복제 (배포된 스냅샷 기반)
        graph_snapshot = deployment.graph_snapshot
        
        # graph_snapshot에서 features 분리 (있다면)
        features = graph_snapshot.get("features", {})
        
        # graph 데이터 (features 제외)
        graph_data = {k: v for k, v in graph_snapshot.items() if k != "features"}

        new_workflow = Workflow(
            tenant_id=user_id,
            app_id=new_app.id,
            created_by=user_id,
            # 스냅샷 기반 데이터 설정
            graph=graph_data,
            features=features,
            # 배포된 버전은 환경변수/런타임변수가 스냅샷에 포함되지 않을 수 있음 (현재 스키마 기준)
            # 따라서 초기화 또는 스냅샷에 있다면 사용
            env_variables=graph_snapshot.get("env_variables", []),
            runtime_variables=graph_snapshot.get("runtime_variables", []),
        )
        db.add(new_workflow)
        db.flush()

        # App에 워크플로우 연결
        new_app.workflow_id = new_workflow.id

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

    @staticmethod
    def _generate_url_slug(db: Session, name: str) -> str:
        """
        앱 이름으로부터 고유한 URL slug를 생성합니다.
        고유한 App URL Slug를 생성합니다.
        형식: app-{random_hex_4} (예: app-a1b2c3d4)
        """
        while True:
            # 8글자 Hex (4 bytes) -> 총 12글자 (app-XXXXXXXX)
            slug = f"app-{secrets.token_hex(4)}"
            # 중복 체크
            if not db.query(App).filter(App.url_slug == slug).first():
                return slug
