import logging
from typing import List, Optional
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from apps.gateway.api.deps import get_db
from apps.gateway.auth.dependencies import get_current_user
from apps.gateway.core.config import settings

# from services.ingestion_local_service import IngestionService
from apps.gateway.services.ingestion.service import (
    IngestionOrchestrator as IngestionService,
)
from apps.gateway.services.retrieval import RetrievalService
from apps.gateway.services.storage import get_storage_service
from apps.shared.db.models.connection import Connection
from apps.shared.db.models.knowledge import Document, KnowledgeBase, SourceType
from apps.shared.db.models.user import User
from apps.shared.schemas.rag import (
    ApiPreviewRequest,
    ChunkPreview,
    DocumentAnalyzeResponse,
    IngestionResponse,
    RAGResponse,
    SearchQuery,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload/presigned-url")
async def generate_presigned_url(
    filename: str = Body(..., embed=True),
    content_type: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
):
    """
    S3 Presigned URL 생성 (프론트엔드 직접 업로드용)

    브라우저가 S3에 직접 파일을 업로드할 수 있는 임시 URL을 생성합니다.
    이를 통해 백엔드 서버 부하를 줄이고 업로드 속도를 향상시킬 수 있습니다.

    Args:
        filename: 업로드할 파일명
        content_type: 파일의 MIME 타입 (예: application/pdf)
        current_user: 인증된 사용자

    Returns:
        dict: {
            "upload_url": 브라우저가 PUT 요청을 보낼 Presigned URL,
            "s3_key": S3 객체 키 (나중에 참조용),
            "method": HTTP 메서드 ("PUT")
        }

    Example:
        Request:
        POST /api/v1/rag/upload/presigned-url
        {
            "filename": "document.pdf",
            "content_type": "application/pdf"
        }

        Response:
        {
            "upload_url": "https://s3.amazonaws.com/...?signature=...",
            "s3_key": "uploads/user-123/abc-123_document.pdf",
            "method": "PUT"
        }
    """
    try:
        storage = get_storage_service()

        # S3 Presigned URL 생성
        presigned_data = storage.generate_presigned_upload_url(
            filename=filename,
            content_type=content_type,
            user_id=str(current_user.id),
        )

        return {
            "upload_url": presigned_data["url"],
            "s3_key": presigned_data["key"],
            "method": presigned_data["method"],
            "use_backend_proxy": presigned_data.get("use_backend_proxy"),
        }
    except Exception as e:
        logger.error(f"Presigned URL generation failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Presigned URL 생성 실패: {str(e)}"
        )


@router.post("/upload", response_model=IngestionResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None, alias="file"),
    knowledge_base_id: Optional[UUID] = Form(None, alias="knowledgeBaseId"),
    source_type: str = Form("FILE", alias="sourceType"),
    # [NEW] S3 Direct Upload Fields
    s3_file_url: Optional[str] = Form(None, alias="s3FileUrl"),
    s3_file_key: Optional[str] = Form(None, alias="s3FileKey"),
    # API Config Fields
    api_url: Optional[str] = Form(None, alias="apiUrl"),
    api_method: str = Form("GET", alias="apiMethod"),
    api_headers: Optional[str] = Form(None, alias="apiHeaders"),
    api_body: Optional[str] = Form(None, alias="apiBody"),
    connection_id: Optional[UUID] = Form(None, alias="connectionId"),
    # 지식 베이스 신규 생성일 때만 필요한 정보들
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    ai_model: Optional[str] = Form(None, alias="embeddingModel"),
    top_k: int = Form(5, alias="topK"),
    similarity_threshold: float = Form(0.7, alias="similarity"),
    # 문서별 청킹 설정
    chunk_size: int = Form(1000, alias="chunkSize"),
    chunk_overlap: int = Form(200, alias="chunkOverlap"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    파일 업로드 및 처리 파이프라인 시작점

    [NEW] S3 Direct Upload 지원:
    - s3_file_url과 s3_file_key가 제공되면 이미 S3에 업로드된 파일로 처리
    - file이 제공되면 기존 방식대로 백엔드를 통해 S3에 업로드 (기존 방식)
    """
    # 0. 환경 변수 확인 (Ingestion Mode)
    ingestion_mode = (settings.STORAGE_TYPE or "LOCAL").upper()
    logger.info(f"=== [upload_document] Request Received (Mode: {ingestion_mode}) ===")

    # 1. 자료 확인 또는 생성
    target_kb_id, target_ai_model = _get_or_create_knowledge_base(
        db,
        current_user,
        knowledge_base_id,
        name,
        description,
        ai_model,
        top_k,
        similarity_threshold,
        file,
    )

    # 2. Ingestion Service 초기화
    local_service = IngestionService(
        db,
        user_id=current_user.id,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        ai_model=target_ai_model,
    )

    # 3. 소스 타입별 데이터 준비 (Strategy Pattern)
    try:
        source_enum = SourceType(source_type)
    except ValueError:
        source_enum = SourceType.FILE

    if source_enum == SourceType.FILE:
        # [NEW] S3 Direct Upload 방식
        if s3_file_url and s3_file_key:
            # 프론트엔드가 이미 S3에 업로드한 경우
            file_path = s3_file_url
            # S3 키에서 파일명 추출 (uploads/user-id/uuid_filename.pdf -> uuid_filename.pdf)
            filename = s3_file_key.split("/")[-1]
            meta_info = {"s3_key": s3_file_key, "upload_method": "direct"}

        # [기존] 백엔드 중계 업로드 방식
        elif file:
            file_path, filename, meta_info = _prepare_file_source(local_service, file)
            meta_info["upload_method"] = "backend"
        else:
            raise HTTPException(
                status_code=400,
                detail="File or S3 URL is required for FILE source type",
            )
    elif source_enum == SourceType.API:
        file_path, filename, meta_info = _prepare_api_source(
            api_url, api_method, api_headers, api_body
        )
    elif source_enum == SourceType.DB:  # [NEW] DB 타입 처리
        file_path, filename, meta_info = _prepare_db_source(
            db, current_user, connection_id
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid source type")

    # 4. DB 레코드 생성 (Pending 상태)
    doc_id = local_service.create_pending_document(
        knowledge_base_id=target_kb_id,
        filename=filename,
        file_path=file_path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        source_type=source_enum,
        meta_info=meta_info,
    )

    return IngestionResponse(
        knowledge_base_id=target_kb_id,
        document_id=doc_id,
        status="pending",
        message="자료가 등록되었습니다. 설정을 확인하고 처리를 시작해주세요.",
    )


def _prepare_db_source(db: Session, user: User, connection_id: Optional[UUID]):
    """DB 소스처리를 위한 데이터 준비"""
    if not connection_id:
        raise HTTPException(
            status_code=400, detail="Connection ID is required for DB source."
        )

    # 연결 정보 조회 및 권한 확인
    conn = (
        db.query(Connection)
        .filter(Connection.id == connection_id, Connection.user_id == user.id)
        .first()
    )
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found.")

    meta_info = {
        "connection_id": str(conn.id),
        "db_type": conn.type,
        "connection_name": conn.name,
    }

    return None, conn.name, meta_info


@router.post("/document/{document_id}/analyze", response_model=DocumentAnalyzeResponse)
async def analyze_document(
    document_id: UUID,
    strategy: str = "llamaparse",  # UI에서 선택한 파싱 전략
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서 분석 API: 페이지 수 및 LlamaParse 비용 예측 반환
    - strategy: 사용자가 UI에서 선택한 파싱 전략 (general 또는 llamaparse)
    """
    ingestion_service = IngestionService(db, user_id=current_user.id)
    try:
        result = await ingestion_service.analyze_document(document_id, strategy)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/document/{document_id}/confirm")
async def confirm_document_parsing(
    document_id: UUID,
    strategy: str = "llamaparse",  # "llamaparse" or "general"
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    비용 승인 대기 중인 문서의 파싱을 재개합니다. (비동기 처리)
    """
    from apps.shared.celery_app import celery_app

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status != "waiting_for_approval":
        raise HTTPException(status_code=400, detail="Document remains in invalid state")

    # 전략 업데이트
    new_meta = dict(doc.meta_info or {})
    new_meta["strategy"] = strategy
    doc.meta_info = new_meta
    db.commit()

    # Celery 태스크 호출 (비동기)
    # queue='ingestion'은 라우팅 설정에 의해 자동 적용됨
    task = celery_app.send_task("ingestion.parse_document", args=[str(document_id)])

    return {
        "message": f"Parsing started in background with strategy: {strategy}",
        "status": "processing",
        "task_id": task.id,
    }


@router.delete("/document/{document_id}")
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서를 삭제합니다. (연관된 청크도 자동 삭제됨)
    """
    # 1. 문서 조회 (권한 확인)
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(Document.id == document_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. 파일 삭제 (S3/Local 자동 분기)
    if doc.file_path:
        storage = get_storage_service()
        try:
            storage.delete(doc.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete file {doc.file_path}: {e}")
            # 파일 삭제 실패해도 DB는 삭제 진행

    # 3. DB 삭제 (Cascade로 청크도 같이 삭제됨)
    db.delete(doc)
    db.commit()

    return {"status": "success", "message": "Document deleted successfully"}


@router.post("/search-test/chat", response_model=RAGResponse)
async def search_test_chat(
    query: SearchQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    [Search Test] RAG Chat Mode
    벡터 검색 + LLM 답변 생성
    """
    retrieval_service = RetrievalService(db, user_id=current_user.id)
    kb_id_str = str(query.knowledge_base_id) if query.knowledge_base_id else None
    response = await retrieval_service.generate_answer_for_test(
        query.query,
        knowledge_base_id=kb_id_str,
        model_id=query.generation_model or "gpt-4o",
    )
    return response


@router.post("/search-test/pure", response_model=List[ChunkPreview])
async def search_test_pure(
    query: SearchQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    [Search Test] Pure Retrieval Mode
    순수 벡터 검색 (LLM 생성 없음)
    """
    retrieval_service = RetrievalService(db, user_id=current_user.id)
    kb_id_str = str(query.knowledge_base_id) if query.knowledge_base_id else None

    # RetrievalService.search_documents 직접 호출 (비동기)
    results = await retrieval_service.search_documents(
        query.query, knowledge_base_id=kb_id_str, top_k=query.top_k or 5
    )
    return results


@router.get("/document/{document_id}/progress")
async def get_document_progress(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    [SSE] 문서 처리 진행 상황을 실시간 스트리밍으로 반환합니다.
    """
    import asyncio
    import json

    from fastapi.responses import StreamingResponse

    from apps.shared.pubsub import get_redis_client

    async def event_generator():
        while True:
            # 1. DB에서 문서 상태 조회 (Polling)
            doc = db.query(Document).get(document_id)

            if not doc:
                yield 'data: {"error": "Document not found"}\n\n'
                break

            status = doc.status

            # 2. Redis에서 실시간 진행률 조회 (에러 핸들링 포함)
            redis_progress = None
            try:
                redis_client = get_redis_client()
                redis_key = f"knowledge_progress:{document_id}"
                redis_progress = redis_client.get(redis_key)
            except Exception as e:
                logger.warning(f"Redis read failed for progress: {e}")

            # 3. 진행률 결정 (상태 기반 우선)
            if status == "completed":
                progress = 100
            elif status == "failed":
                progress = 0
            elif redis_progress:
                try:
                    progress = int(redis_progress)
                except (ValueError, TypeError):
                    # Redis 값이 손상되었으면 이번 전송 건너뛰고 재시도
                    continue
            else:
                progress = 0

            # 메타 정보에서는 메시지만 가져옴
            meta = doc.meta_info or {}
            step_message = meta.get("processing_current_step", "처리 중...")

            # 4. 데이터 전송 포맷 (SSE 표준: "data: ...\n\n")
            data = json.dumps(
                {
                    "progress": progress,
                    "message": step_message,
                    "status": status,
                    "error": doc.error_message,
                },
                ensure_ascii=False,
            )

            yield f"data: {data}\n\n"

            # 5. 종료 조건
            if status == "completed" or progress >= 100:
                break
            if status == "failed":
                break

            # 1초 대기 (서버 부하 방지)
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/proxy/preview")
async def proxy_api_preview(
    request: ApiPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    프론트엔드 CORS 문제 해결을 위한 API 프록시 엔드포인트
    requests -> httpx (Async) 로 변경 (timeout 이슈 해결을 위해)
    """
    import httpx

    # 기본 헤더가 없으면 추가
    headers = request.headers or {}
    if "User-Agent" not in headers:
        headers["User-Agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        )

    try:
        # 비동기 클라이언트 사용 (http_node.py 참조)
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
            response = await client.request(
                method=request.method,
                url=request.url,
                headers=headers,
                json=request.body if request.method != "GET" else None,
            )

            # 4xx, 5xx 에러 발생 시 예외 발생
            response.raise_for_status()

            try:
                data = response.json()
            except Exception:
                data = response.text

            return {
                "status": response.status_code,
                "data": data,
                "headers": dict(response.headers),
            }

    except httpx.HTTPStatusError as e:
        # 외부 API가 에러 응답(4xx, 5xx)을 준 경우
        status_code = e.response.status_code
        try:
            detail = e.response.json()
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=status_code, detail=detail)

    except httpx.TimeoutException:
        logger.error("[Proxy Log] 타임아웃 발생 (Timeout)")
        raise HTTPException(status_code=504, detail="External API Timeout")

    except httpx.RequestError as e:
        logger.error(f"[Proxy Log] 연결 실패 (RequestError): {e}")
        raise HTTPException(
            status_code=502, detail=f"External API Connection Error: {str(e)}"
        )

    except Exception as e:
        logger.error(f"[Proxy Log] 기타 오류 발생: {type(e).__name__} - {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _get_or_create_knowledge_base(
    db: Session,
    user: User,
    kb_id: Optional[UUID],
    name: Optional[str],
    description: Optional[str],
    ai_model: Optional[str],
    top_k: int,
    similarity_threshold: float,
    file: Optional[UploadFile],
) -> tuple[UUID, str]:
    """자료를 조회하거나 새로 생성합니다."""
    if not kb_id:
        if not ai_model:
            raise HTTPException(
                status_code=400,
                detail="Embedding model must be selected for new Knowledge Base",
            )

        # 이름 결정: 입력된 이름 -> (파일 있으면 파일명) -> "API Source"
        kb_name = name if name else (file.filename if file else "API Source")

        new_kb = KnowledgeBase(
            user_id=user.id,
            name=kb_name,
            description=description,
            embedding_model=ai_model,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )
        db.add(new_kb)
        db.commit()
        db.refresh(new_kb)
        return new_kb.id, ai_model

    else:
        kb: KnowledgeBase = (
            db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        )
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")
        return kb.id, kb.embedding_model


def _prepare_file_source(local_service: IngestionService, file: Optional[UploadFile]):
    """파일 자료 처리를 위한 데이터 준비"""
    if not file:
        raise HTTPException(status_code=400, detail="File is required for FILE source")

    file_path = local_service.save_temp_file(file)
    filename = file.filename
    return file_path, filename, {}


def _prepare_api_source(
    api_url: Optional[str],
    api_method: str,
    api_headers: Optional[str],
    api_body: Optional[str],
):
    """API 자료 처리를 위한 데이터 준비"""
    if not api_url:
        raise HTTPException(status_code=400, detail="API URL is required")

    import json

    from apps.shared.utils.encryption import encryption_manager as security_service

    # 헤더 처리 (JSON 파싱 및 암호화)
    encrypted_headers = None
    if api_headers:
        try:
            json.loads(api_headers)  # 유효성 검증
            encrypted_headers = security_service.encrypt(api_headers)
        except Exception as e:
            logger.warning(f"Failed to process headers: {e}")
            pass

    # 바디 처리 (JSON 파싱)
    body = None
    if api_body:
        try:
            body = json.loads(api_body)
        except Exception as e:
            logger.warning(f"Failed to parse body: {e}")
            pass

    meta_info = {
        "api_config": {
            "url": api_url,
            "method": api_method,
            "headers": encrypted_headers,
            "body": body,
        }
    }

    return None, api_url, meta_info
