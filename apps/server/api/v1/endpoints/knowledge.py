import mimetypes
import os
from typing import List
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from auth.dependencies import get_current_user
from db.models.knowledge import Document, KnowledgeBase
from db.models.user import User
from schemas.rag import (
    DocumentPreviewRequest,
    DocumentPreviewResponse,
    DocumentResponse,
    KnowledgeBaseDetailResponse,
    KnowledgeBaseResponse,
    KnowledgeUpdate,
)
from services.ingestion.service import IngestionOrchestrator as IngestionService

router = APIRouter()


@router.get("", response_model=List[KnowledgeBaseResponse])
def list_knowledge_bases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    사용자의 지식 베이스 목록을 조회합니다.
    각 지식 베이스에 포함된 문서 개수도 함께 반환합니다.
    """
    results = (
        db.query(KnowledgeBase, func.count(Document.id).label("document_count"))
        .outerjoin(Document, KnowledgeBase.id == Document.knowledge_base_id)
        .filter(KnowledgeBase.user_id == current_user.id)
        .group_by(KnowledgeBase.id)
        .order_by(KnowledgeBase.created_at.desc())
        .all()
    )

    response = []
    for kb, doc_count in results:
        response.append(
            KnowledgeBaseResponse(
                id=kb.id,
                name=kb.name,
                description=kb.description,
                document_count=doc_count,
                created_at=kb.created_at,
                embedding_model=kb.embedding_model,
            )
        )
    return response


@router.get("/{kb_id}", response_model=KnowledgeBaseDetailResponse)
def get_knowledge_base(
    kb_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특전 지식 베이스의 상세 정보를 조회합니다.
    포함된 문서 목록과 각 문서의 상태를 함께 반환합니다.
    """
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    # 문서 목록 변환
    doc_responses = []
    for doc in kb.documents:
        # TODO: 청크 개수나 토큰 수는 별도 쿼리로 최적화 필요 (현재는 Lazy Loading)
        doc_responses.append(
            DocumentResponse(
                id=doc.id,
                filename=doc.filename,
                status=doc.status,
                created_at=doc.created_at,
                error_message=doc.error_message,
                chunk_count=len(doc.chunks),  # N+1 발생 가능, 추후 최적화
                token_count=0,  # 우선 0으로 반환
                source_type=doc.source_type,
                meta_info=doc.meta_info,
            )
        )

    return KnowledgeBaseDetailResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        document_count=len(doc_responses),
        created_at=kb.created_at,
        embedding_model=kb.embedding_model,
        documents=doc_responses,
    )


@router.patch("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_knowledge_base(
    kb_id: UUID,
    update_data: KnowledgeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    지식 베이스의 설정을 수정합니다. (이름, 설명)
    """
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge Base not found")

    if update_data.name is not None:
        kb.name = update_data.name
    if update_data.description is not None:
        kb.description = update_data.description

    db.commit()
    db.refresh(kb)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{kb_id}/documents/{document_id}", response_model=DocumentResponse)
def get_document(
    kb_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    특정 문서를 조회합니다.
    """
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(Document.id == document_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=400, detail="Document does not belong to this Knowledge Base"
        )

    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        status=doc.status,
        created_at=doc.created_at,
        error_message=doc.error_message,
        chunk_count=len(doc.chunks),
        # token_count=doc.token_count,
        source_type=doc.source_type,
        meta_info=doc.meta_info,
    )


@router.get("/{kb_id}/documents/{document_id}/content")
def get_document_content(
    kb_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서의 원본 파일을 반환합니다. (브라우저 표시용)
    """
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(Document.id == document_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=400, detail="Document does not belong to this Knowledge Base"
        )

    # API 소스는 파일이 없으므로 미리보기 불가 처리
    if doc.source_type == "API" or not doc.file_path:
        # 204 No Content를 주면 브라우저가 아무것도 안할 수 있으니
        # 명확하게 파일이 없음을 알리는게 낫습니다.
        raise HTTPException(
            status_code=400,
            detail="API로 받은 응답은 원문 보기를 제공하지 않습니다.",
        )

    # 파일 존재 확인
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    # 미디어 타입 추론
    media_type, _ = mimetypes.guess_type(doc.file_path)
    if not media_type:
        media_type = "application/octet-stream"

    # Excel/CSV 파일은 HTML로 변환하여 미리보기 제공
    ext = os.path.splitext(doc.filename)[1].lower()
    if ext in [".xlsx", ".xls", ".csv"]:
        try:
            if ext == ".csv":
                df = pd.read_csv(doc.file_path, nrows=100)
            else:
                df = pd.read_excel(doc.file_path, nrows=100)

            # HTML 스타일링
            html_content = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #ffffff; }}
                    table {{ border-collapse: collapse; width: 100%; font-size: 14px; border: 1px solid #e5e7eb; }}
                    th {{ background-color: #f9fafb; color: #374151; font-weight: 600; text-align: left; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }}
                    td {{ padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #4b5563; }}
                    tr:last-child td {{ border-bottom: none; }}
                    tr:hover td {{ background-color: #f9fafb; }}
                    .info-banner {{
                        margin-bottom: 16px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fcd34d;
                        color: #92400e; border-radius: 6px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 6px;
                    }}
                </style>
            </head>
            <body>
                <div class="info-banner">
                    <span>⚠️</span>
                    성능을 위해 상위 100행만 미리보기로 제공됩니다.
                </div>
                {df.to_html(index=False, border=0)}
            </body>
            </html>
            """
            return HTMLResponse(content=html_content)
        except Exception as e:
            print(f"Excel conversion failed: {e}")
            # 변환 실패 시 다운로드로 fallback

    return FileResponse(
        doc.file_path,
        filename=doc.filename,
        media_type=media_type,
        content_disposition_type="inline",
    )


@router.post(
    "/{kb_id}/documents/{document_id}/process", status_code=status.HTTP_202_ACCEPTED
)
async def process_document(
    kb_id: UUID,
    document_id: UUID,
    request: DocumentPreviewRequest,  # 설정값은 Preview와 동일하므로 재사용하거나 별도 정의
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서 설정(청킹 등)을 저장하고 백그라운드 처리를 시작합니다.
    """
    # 1. 문서 조회 (권한 확인)
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == document_id,
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 2. 설정 업데이트
    doc.chunk_size = request.chunk_size
    doc.chunk_overlap = request.chunk_overlap

    # 메타데이터에 추가 설정 저장
    new_meta = dict(doc.meta_info or {})
    new_meta.update(
        {
            "segment_identifier": request.segment_identifier,
            "remove_urls_emails": request.remove_urls_emails,
            "remove_whitespace": request.remove_whitespace,
            "db_config": request.db_config,
        }
    )
    doc.meta_info = new_meta

    # 상태 업데이트 (처리 시작 전)
    doc.status = (
        "indexing"  # IngestionService가 실행되기 전부터 UI에서 처리중으로 표시하기 위함
    )
    db.commit()

    # 3. 백그라운드 작업 시작
    ingestion_service = IngestionService(
        db,
        user_id=current_user.id,
        chunk_size=request.chunk_size,
        chunk_overlap=request.chunk_overlap,
        ai_model=doc.knowledge_base.embedding_model,
    )

    background_tasks.add_task(
        ingestion_service.process_document,
        document_id,
    )

    return {"status": "processing", "message": "Document processing started"}


@router.post(
    "/{kb_id}/documents/{document_id}/preview", response_model=DocumentPreviewResponse
)
def preview_document_chunking(
    kb_id: UUID,
    document_id: UUID,
    request: DocumentPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서 청킹 설정을 미리보기 합니다. DB를 업데이트하지 않고 결과만 반환합니다.
    """
    # 1. 문서 존재 및 권한 확인
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(Document.id == document_id, KnowledgeBase.user_id == current_user.id)
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.knowledge_base_id != kb_id:
        raise HTTPException(
            status_code=400, detail="Document does not belong to this Knowledge Base"
        )

    # 2. 서비스 호출
    service = IngestionService(db, user_id=current_user.id)
    try:
        segments = service.preview_chunking(
            file_path=doc.file_path,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            segment_identifier=request.segment_identifier,
            remove_urls_emails=request.remove_urls_emails,
            remove_whitespace=request.remove_whitespace,
            strategy=request.strategy,
            source_type=request.source_type,
            meta_info=doc.meta_info,
            db_config=request.db_config,
        )
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

    # 3. 응답 반환
    return DocumentPreviewResponse(
        segments=segments,
        total_count=len(segments),
        preview_text_sample="",  # 필요시 원본 텍스트 일부 반환 가능
    )


@router.post(
    "/{kb_id}/documents/{document_id}/sync", status_code=status.HTTP_202_ACCEPTED
)
async def sync_document(
    kb_id: UUID,
    document_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    문서를 동기화합니다. (API 소스 등 재위)
    기존 설정을 유지하면서 처리를 다시 시작합니다.
    """
    # 1. 문서 조회
    doc = (
        db.query(Document)
        .join(KnowledgeBase)
        .filter(
            Document.id == document_id,
            KnowledgeBase.id == kb_id,
            KnowledgeBase.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 상태 업데이트
    doc.status = "indexing"
    db.commit()

    # 2. 백그라운드 작업 시작
    ingestion_service = IngestionService(
        db,
        user_id=current_user.id,
        chunk_size=doc.chunk_size,
        chunk_overlap=doc.chunk_overlap,
        ai_model=doc.knowledge_base.embedding_model,
    )

    background_tasks.add_task(
        ingestion_service.process_document,
        document_id,
    )

    return {"status": "processing", "message": "Document sync started"}
