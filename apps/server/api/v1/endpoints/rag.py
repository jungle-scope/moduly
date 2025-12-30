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
from db.models.knowledge import KnowledgeBase
from db.models.user import User
from schemas.rag import IngestionResponse, RAGResponse, SearchQuery
from services.ingestion import IngestionService
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
    # [Debug Log] 수신된 데이터 확인
    print("=== [upload_document] Request Received ===")
    print(f"filename: {file.filename}")
    print(f"knowledge_base_id: {knowledge_base_id}")
    print(f"name: {name}, description: {description}")
    print(
        f"ai_model: {ai_model}, top_k: {top_k}, similarity_threshold: {similarity_threshold}"
    )
    print(f"chunk_size: {chunk_size}, chunk_overlap: {chunk_overlap}")
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

        # 데이터 무결성을 지키 위해 DB에 저장된 KB의 원래 모델을 사용한다.
        target_kb_id = kb.id
        target_ai_model = kb.embedding_model

    # 공통 로직: Ingestion 파이프라인 시작
    ingestion_service = IngestionService(
        db,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        ai_model=target_ai_model,
    )

    # [1] 파일 임시 저장
    # PyMuPDFLoader가 파일 경로를 요구하기 때문에 디스크에 물리적으로 있어야 합니다.
    file_path = ingestion_service.save_temp_file(file)

    # [2] DB 레코드 생성 (Pending 상태)
    # 비동기 작업이 실패하더라도 "파일이 올라왔었다"는 흔적(DB)은 남긴다
    doc_id = ingestion_service.create_pending_document(
        knowledge_base_id=target_kb_id,
        filename=file.filename,
        file_path=file_path,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    # [3] 비동기 작업 트리거 (Background Task)
    # 파싱/임베딩은 시간이 오래 걸리므로 사용자에게는 먼저 응답을 보내고 백그라운드에서 처리
    background_tasks.add_task(
        ingestion_service.process_document_background,
        doc_id,
        target_kb_id,
        file_path,
    )

    return IngestionResponse(
        knowledge_base_id=target_kb_id,  # 프론트엔드 이동용
        document_id=doc_id,
        status="processing",
        message="지식 베이스 생성 및 파일 업로드가 시작되었습니다.",
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
