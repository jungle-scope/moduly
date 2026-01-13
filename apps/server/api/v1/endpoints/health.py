from fastapi import APIRouter, Response, status
from sqlalchemy import text

from apps.shared.db.session import SessionLocal

router = APIRouter()


@router.get("/health")
def health_check(response: Response):
    """
    헬스 체크 엔드포인트입니다. 배포 단계시 문제 확인 용으로 사용합니다.
    - 서비스 상태 확인
    - 데이터베이스 연결 확인

    Returns:
        - 200 OK: 모든 서비스 정상
        - 503 Service Unavailable: 서비스 이상
    """
    db_ok = False
    db_message = None

    try:
        # DB 연결 확인
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            db_ok = True
        except Exception as e:
            db_message = str(e)
        finally:
            db.close()
    except Exception as e:
        db_message = str(e)

    # DB가 정상이면 200 OK
    if db_ok:
        return {
            "status": "ok",
            "service": "Moduly API",
            "database": "ok",
        }

    # DB 문제가 있으면 503 Service Unavailable
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "error",
        "service": "Moduly API",
        "database": f"error: {db_message}",
    }
