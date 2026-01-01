import os
from typing import Optional
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

from api.deps import get_db
from auth.dependencies import get_current_user
from db.models.knowledge import Document, KnowledgeBase
from db.models.user import User
from schemas.rag import IngestionResponse, RAGResponse, SearchQuery
from services.ingestion_local_service import IngestionService
from services.retrieval import RetrievalService

router = APIRouter()


@router.post("/upload", response_model=IngestionResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., alias="file"),
    knowledge_base_id: Optional[UUID] = Form(None, alias="knowledgeBaseId"),
    # 지식베이스 신규 생성일 때만 필요한 정보들
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
    """
    # 0. 환경 변수 확인 (Ingestion Mode)
    ingestion_mode = os.getenv("RAG_INGESTION_MODE", "LOCAL").upper()
    print(f"=== [upload_document] Request Received (Mode: {ingestion_mode}) ===")

    # [Debug Log] 수신된 데이터 확인
    print(f"filename: {file.filename}")
    print(f"knowledge_base_id: {knowledge_base_id}")
    print(f"name: {name}, description: {description}")
    print(
        f"ai_model: {ai_model}, top_k: {top_k}, similarity_threshold: {similarity_threshold}"
    )
    ########################

    target_kb_id = knowledge_base_id
    target_ai_model = ai_model

    # 지식베이스가 없으면 신규 생성
    if not knowledge_base_id:
        if not ai_model:
            raise HTTPException(
                status_code=400,
                detail="Embedding model must be selected for new Knowledge Base",
            )

        user_id = current_user.id
        new_kb = KnowledgeBase(
            user_id=user_id,
            name=name if name else file.filename,  # 이름 없으면 파일명으로
            description=description,
            embedding_model=ai_model,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )
        db.add(new_kb)
        db.commit()
        db.refresh(new_kb)

        target_kb_id = new_kb.id

    # 지식베이스가 있으면 사용
    else:
        kb = (
            db.query(KnowledgeBase)
            .filter(KnowledgeBase.id == knowledge_base_id)
            .first()
        )
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge Base not found")

        # 데이터 무결성 지키 위해 DB에 저장된 KB의 원래 모델을 사용한다.
        target_kb_id = kb.id
        target_ai_model = kb.embedding_model

    # Common Logic: LocalIngestionService를 유틸리티처럼 사하여 파일 저장 및 DB 레코드 생성
    # (Bedrock 모드여도 DB에 흔적은 남겨야 하므로 LocalIngestionService를 활용)
    local_service = IngestionService(
        db,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        ai_model=target_ai_model,
    )

    # [1] 파일 임시 저장
    # PyMuPDFLoader가 파일 경로를 요구하기 때문에 디스크에 물리적으로 있어야 합니다.
    file_path = local_service.save_temp_file(file)

    # [2] DB 레코드 생성 (Pending 상태)
    # 비동기 작업이 실패하더라도 "파일이 올라왔었다"는 흔적(DB)은 남긴다
    doc_id = local_service.create_pending_document(
        knowledge_base_id=target_kb_id,
        filename=file.filename,
        file_path=file_path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    # [3] 비동기 작업 트리거 (분기 처리)
    if ingestion_mode == "BEDROCK":
        from services.ingestion_bedrock_service import BedrockIngestionService

        bedrock_service = BedrockIngestionService()
        background_tasks.add_task(
            bedrock_service.process_document,
            file_path=file_path,
            filename=file.filename,
            document_id=str(doc_id),
        )
    else:
        # LOCAL Mode (Default)
        background_tasks.add_task(
            local_service.process_document_background,
            doc_id,
            target_kb_id,
            file_path,
        )

    return IngestionResponse(  # TODO: 프론트에서 응답 받아서 사용
        knowledge_base_id=target_kb_id,  # 프론트엔드 이동용
        document_id=doc_id,
        status="processing",
        message=f"지식 베이스 생성 및 파일 업로드가 시작되었습니다. (Mode: {ingestion_mode})",
    )


@router.post("/document/{document_id}/confirm")
async def confirm_document_parsing(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    비용 승인 대기 중인 문서의 파싱을 재개합니다.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.status != "waiting_for_approval":
        raise HTTPException(status_code=400, detail="Document remains in invalid state")

    # 서비스 초기화 및 재개 (백그라운드)
    # 기존 설정(청크 사이즈 등)은 DB doc에 저장되어 있으므로 불러와서 쓴다고 가정
    ingestion_service = IngestionService(db)

    background_tasks.add_task(
        ingestion_service.resume_with_llamaparse,
        document_id,
    )

    return {"message": "Parsing resumed with LlamaParse", "status": "processing"}


@router.post("/chat", response_model=RAGResponse)
def chat_with_knowledge(query: SearchQuery, db: Session = Depends(get_db)):
    """
    [개발자 B 범위]
    벡터 검색 -> LLM 생성
    """
    retrieval_service = RetrievalService(db)
    kb_id_str = str(query.knowledge_base_id) if query.knowledge_base_id else None
    response = retrieval_service.generate_answer(
        query.query, knowledge_base_id=kb_id_str
    )
    return response
