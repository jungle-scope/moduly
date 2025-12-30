from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.deps import get_db
from auth.dependencies import get_current_user
from db.models.knowledge import Document, KnowledgeBase
from db.models.user import User
from schemas.rag import KnowledgeBaseResponse

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
