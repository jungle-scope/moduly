import os
import sys
import uuid

import requests
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from db.models.user import User
from db.models.workflow import Workflow
from db.models.workflow_deployment import DeploymentType, WorkflowDeployment

# DB Connection (Assuming default local dev settings)
SQLALCHEMY_DATABASE_URL = "postgresql://admin:admin123@localhost:5432/moduly"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def verify_endpoint():
    db = SessionLocal()
    try:
        # 1. Create Dummy User
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email=f"test-{user_id}@example.com",
            password="dummy",
            name="Test User",
        )
        db.add(user)

        # 2. Create Dummy Workflow
        workflow_id = uuid.uuid4()
        workflow = Workflow(
            id=workflow_id,
            tenant_id="test-tenant",
            app_id="test-app",
            marked_name="Test Workflow",
            marked_comment="For verification",
            graph={"nodes": [], "edges": [], "viewport": {}},
            created_by=str(user_id),
        )
        db.add(workflow)

        # 3. Create Dummy Deployment
        url_slug = f"test-slug-{uuid.uuid4().hex[:8]}"
        auth_secret = "test-secret-key"

        # Simple graph: Start -> End
        graph_snapshot = {
            "nodes": [
                {
                    "id": "start-1",
                    "type": "startNode",
                    "position": {"x": 0, "y": 0},
                    "data": {
                        "variables": [],
                        "title": "Start",
                        "triggerType": "manual",
                    },
                },
                {
                    "id": "end-1",
                    "type": "answerNode",
                    "position": {"x": 200, "y": 0},
                    "data": {"title": "Result", "outputs": []},
                },
            ],
            "edges": [{"id": "e1", "source": "start-1", "target": "end-1"}],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        }

        deployment = WorkflowDeployment(
            workflow_id=workflow_id,
            version=1,
            type=DeploymentType.API,
            url_slug=url_slug,
            auth_secret=auth_secret,
            graph_snapshot=graph_snapshot,
            created_by=user_id,
            is_active=True,
        )
        db.add(deployment)
        db.commit()

        print(f"[Setup] Deployment created: /api/v1/run/{url_slug}")

        # 4. Call API
        api_url = f"http://localhost:8000/api/v1/run/{url_slug}"
        headers = {"X-Auth-Secret": auth_secret, "Content-Type": "application/json"}
        payload = {"inputs": {}}

        print(f"[Test] Calling {api_url}...")
        try:
            response = requests.post(api_url, json=payload, headers=headers, timeout=5)
        except requests.exceptions.Timeout:
            print("❌ Error: Request timed out")
            return

        print(f"[Result] Status Code: {response.status_code}")
        print(f"[Result] Body: {response.json()}")

        if response.status_code == 200 and response.json()["status"] == "success":
            print("✅ Verification PASSED")
        else:
            print("❌ Verification FAILED")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        # Cleanup (Optional: might want to keep for manual checking)
        # db.delete(deployment)
        # db.delete(workflow)
        # db.delete(user)
        # db.commit()
        db.close()


if __name__ == "__main__":
    verify_endpoint()
