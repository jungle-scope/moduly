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
from schemas.rag import (
    DocumentAnalyzeResponse,
    IngestionResponse,
    RAGResponse,
    SearchQuery,
)
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
        user_id=current_user.id,
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

    print(
        f"=== [upload_document] Auto-processing skipped. Document {doc_id} is pending configuration. ==="
    )

    return IngestionResponse(  # TODO: 프론트에서 응답 받아서 사용
        knowledge_base_id=target_kb_id,  # 프론트엔드 이동용
        document_id=doc_id,
        status="processing",
        message=f"지식 베이스 생성 및 파일 업로드가 시작되었습니다. (Mode: {ingestion_mode})",
    )


@router.post("/document/{document_id}/analyze", response_model=DocumentAnalyzeResponse)
async def analyze_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서 분석 API: 페이지 수 및 LlamaParse 비용 예측 반환
    """
    ingestion_service = IngestionService(db, user_id=current_user.id)
    try:
        result = await ingestion_service.analyze_document(document_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/document/{document_id}/confirm")
async def confirm_document_parsing(
    document_id: UUID,
    background_tasks: BackgroundTasks,
    strategy: str = "llamaparse",  # "llamaparse" or "general"
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
    ingestion_service = IngestionService(db, user_id=current_user.id)

    background_tasks.add_task(
        ingestion_service.resume_processing,
        document_id,
        strategy,
    )

    return {
        "message": f"Parsing resumed with strategy: {strategy}",
        "status": "processing",
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

    # 2. 파일 삭제 (TODO: S3파일도 지우려면 로직 추가 필요함)
    import os

    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # 3. DB 삭제 (Cascade로 청크도 같이 삭제됨)
    db.delete(doc)
    db.commit()

    return {"status": "success", "message": "Document deleted successfully"}


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

    async def event_generator():
        while True:
            # 1. DB에서 문서 상태 조회 (Polling)
            doc = db.query(Document).get(document_id)

            if not doc:
                yield 'data: {"error": "Document not found"}\n\n'
                break

            # 2. meta_info에서 진행 정보 가져오기
            meta = doc.meta_info or {}
            progress = meta.get("processing_progress", 0)
            step_message = meta.get("processing_current_step", "대기 중...")
            status = doc.status

            # 3. 데이터 전송 포맷 (SSE 표준: "data: ...\n\n")
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

            # 4. 종료 조건
            if status == "completed" or progress >= 100:
                break
            if status == "failed":
                break

            # 1초 대기 (서버 부하 방지)
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
