from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from db.session import get_db
from db.models.knowledge import KnowledgeBase
from schemas.rag import IngestionResponse, RAGResponse, SearchQuery
from services.ingestion import IngestionService
from services.retrieval import RetrievalService

router = APIRouter()


@router.post("/upload", response_model=IngestionResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., alias="file"),
    knowledge_base_id: UUID = Form(..., alias="knowledgeBaseId"),
    chunk_size: int = Form(1000, alias="chunkSize"),
    chunk_overlap: int = Form(200, alias="chunkOverlap"),
    db: Session = Depends(get_db),
):
    """
    파일 업로드 및 처리 파이프라인 시작점
    """
    # [0] 지식 베이스 조회 (모델 정보 획득)
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == knowledge_base_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    ingestion_service = IngestionService(
        db,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        ai_model=kb.embedding_model,  # KB에 설정된 모델 사용 (강제)
    )

    # [1] 파일 임시 저장
    # PyMuPDFLoader가 파일 경로를 요구하기 때문에 디스크에 물리적으로 있어야 함
    file_path = ingestion_service.save_temp_file(file)

    # [2] DB 레코드 생성 (Pending)
    # 비동기 작업 중 실패하더라도 기록을 남기고 상태를 추적한다
    doc_id = ingestion_service.create_pending_document(
        knowledge_base_id=knowledge_base_id,
        filename=file.filename,
        file_path=file_path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    # 3. 비동기 작업 트리거
    # 파싱/임베딩은 시간이 오래 걸리므로 사용자에게는 먼저 응답을 보내고 백그라운드에서 처리
    background_tasks.add_task(
        ingestion_service.process_document_background,
        doc_id,
        knowledge_base_id,
        file_path,
    )

    return IngestionResponse(
        document_id=doc_id,
        status="processing",
        message="파일 업로드가 완료되어 백그라운드 처리를 시작했습니다.",
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
