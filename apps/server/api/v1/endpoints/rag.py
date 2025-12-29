from uuid import UUID

from api.deps import get_db
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from schemas.rag import IngestionResponse, RAGResponse, SearchQuery
from services.ingestion import IngestionService
from services.retrieval import RetrievalService

router = APIRouter()


@router.post("/ingest", response_model=IngestionResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    knowledge_base_id: UUID = Form(...),  # Form 데이터로 knowledge_base_id 수신
    db: Session = Depends(get_db),
):
    """
    [개발자 A 범위]
    PDF 업로드 -> 파일 로컬 저장 -> 백그라운드 비동기 처리 트리거
    """
    # 1. 파일 로컬 저장
    file_location = f"apps/server/uploads/{file.filename}"
    # 실제 운영 환경에서는 안전한 파일명 생성 및 중복 처리 필요
    with open(file_location, "wb") as f:
        f.write(file.file.read())

    # 2. DB 레코드 생성 (Pending 상태)
    ingestion_service = IngestionService(db)

    # knowledge_base_id를 전달하여 Document 생성
    doc_id = ingestion_service.create_pending_document(
        knowledge_base_id=knowledge_base_id,
        filename=file.filename,
        file_path=file_location,
    )

    # 3. 비동기 작업 트리거
    background_tasks.add_task(
        ingestion_service.process_document_background, doc_id, file_location
    )

    return IngestionResponse(
        document_id=doc_id,
        status="processing",
        message="문서 업로드가 시작되었습니다. 백그라운드에서 처리중입니다.",
    )


@router.post("/chat", response_model=RAGResponse)
def chat_with_knowledge(query: SearchQuery, db: Session = Depends(get_db)):
    """
    [개발자 B 범위]
    벡터 검색 -> LLM 생성
    """
    retrieval_service = RetrievalService(db)
    response = retrieval_service.generate_answer(query.query)
    return response
