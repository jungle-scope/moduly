"""
RAG 평가용 문서 Knowledge Base 인덱싱 스크립트

이 스크립트는 준비된 데이터셋의 문서들을
Knowledge Base에 인덱싱합니다.

사용법:
    # 1. 데이터셋 준비 (먼저 실행)
    python tests/evaluation/prepare_datasets.py --dataset hotpotqa --samples 100

    # 2. 문서 인덱싱
    python tests/evaluation/index_documents.py --dataset hotpotqa --kb-name "RAG Eval - HotpotQA"

Author: Antigravity Team
Created: 2026-01-13
"""

import argparse
import asyncio
import json
import os
import re
import sys
import unicodedata
from typing import Any, Dict, List
from uuid import UUID

# 프로젝트 루트를 path에 추가
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from apps.gateway.services.llm_service import LLMService
from apps.shared.db.models.knowledge import (
    Document,
    DocumentChunk,
    KnowledgeBase,
    SourceType,
)
from apps.shared.db.models.user import User
from apps.shared.db.session import SessionLocal


def get_or_create_kb(
    db: Session,
    user_id: UUID,
    kb_name: str,
    embedding_model: str = "text-embedding-3-small",
) -> KnowledgeBase:
    """
    Knowledge Base 조회 또는 생성
    """
    # 기존 KB 찾기
    kb = (
        db.query(KnowledgeBase)
        .filter(KnowledgeBase.user_id == user_id, KnowledgeBase.name == kb_name)
        .first()
    )

    if kb:
        print(f"✅ Knowledge Base 생성: {kb.name}")
        return kb

    # 새 KB 생성
    kb = KnowledgeBase(
        user_id=user_id,
        name=kb_name,
        description="RAG 성능 평가용 Knowledge Base",
        embedding_model=embedding_model,
        top_k=5,
        similarity_threshold=0.3,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)

    print(f"✅ Knowledge Base 생성: {kb.name}")
    return kb


def preprocess_text(text: str, options: Dict[str, Any]) -> str:
    """
    RAG를 위한 텍스트 전처리 (IngestionOrchestrator와 동일)
    """
    # === 필수 전처리 (항상 적용) ===
    # 1. 유니코드 정규화 (한글 자모 분리 방지)
    text = unicodedata.normalize("NFC", text)

    # === 선택적 전처리 ===
    # 2. 마크다운 구분자 처리
    if options.get("remove_markdown_separators", True):
        text = re.sub(r"^-{3,}$", "\n", text, flags=re.MULTILINE)
        text = re.sub(r"^\*{3,}$", "\n", text, flags=re.MULTILINE)
        text = re.sub(r"^={3,}$", "\n", text, flags=re.MULTILINE)

    # 3. URL/이메일 제거
    if options.get("remove_urls_emails", False):
        text = re.sub(
            r"(?:https?|ftps?)://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
            "",
            text,
        )
        text = re.sub(r"[\w\.-]+@[\w\.-]+\.\w+", "", text)

    # 4. 공백 정규화
    if options.get("normalize_whitespace", True):
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n[ \t]+", "\n", text)

    # 5. 제어 문자 제거 (탭, 줄바꿈 제외)
    if options.get("remove_control_chars", True):
        text = "".join(
            char
            for char in text
            if unicodedata.category(char)[0] != "C" or char in "\n\t"
        )

    # === 필수 전처리 (마무리) ===
    # 6. 앞뒤 공백 제거
    text = text.strip()

    return text


async def index_documents(
    db: Session,
    kb: KnowledgeBase,
    documents: List[Dict[str, Any]],
    user_id: UUID,
    batch_size: int = 10,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> tuple[int, int]:
    """
    문서들을 Knowledge Base에 인덱싱

    Args:
        documents: [{"id": "", "title": "", "content": ""}, ...]

    Returns:
        (인덱싱된 청크 수, 총 토큰 수)
    """
    total_chunks = 0
    total_tokens = 0
    embedding_model = kb.embedding_model

    # LLM 클라이언트 획득
    try:
        embed_client = LLMService.get_client_for_user(db, user_id, embedding_model)
    except Exception as e:
        print(f"[ERROR] 임베딩 클라이언트 획득 실패: {e}")
        print("[ERROR] LLM Provider가 등록되어 있는지 확인하세요.")
        return 0

    print(f"[Index] {len(documents)}개 문서 인덱싱 시작...")
    print(f"[Index] 임베딩 모델: {embedding_model}")

    for i, doc in enumerate(documents):
        doc_id = doc.get("id", f"doc_{i}")
        title = doc.get("title", f"Document {i}")
        content = doc.get("content", "")

        if not content.strip():
            continue

        # Document 레코드 생성
        document = Document(
            knowledge_base_id=kb.id,
            filename=f"{doc_id}.txt",
            source_type=SourceType.API,
            status="indexing",
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            meta_info={"source": doc.get("source", "evaluation"), "title": title},
        )
        db.add(document)
        db.flush()

        # 전처리 (서비스와 동일한 로직 적용)
        options = {
            "remove_urls_emails": False,  # HotpotQA는 URL/Email 제거 불필요
            "normalize_whitespace": True,
            "remove_markdown_separators": True,
            "remove_control_chars": True,
        }
        content = preprocess_text(content, options)

        # 청킹 (RecursiveCharacterTextSplitter 사용 - 서비스와 동일)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ".", " ", ""],
            keep_separator=True,
        )

        split_texts = text_splitter.split_text(content)
        chunks = [{"content": t, "index": idx} for idx, t in enumerate(split_texts)]
        for chunk in chunks:
            try:
                embedding = await embed_client.embed(chunk["content"])

                # 키워드 추출 (YAKE - entity/proper noun 중심)
                keywords = []
                try:
                    import yake

                    # YAKE Extractor 설정
                    # max_ngram_size=3: 최대 3단어 키워드
                    # deduplication_threshold=0.9: 중복 제거
                    # n=10: 상위 10개 추출
                    kw_extractor = yake.KeywordExtractor(
                        lan="en", n=3, dedupLim=0.9, top=10, features=None
                    )
                    yake_keywords = kw_extractor.extract_keywords(chunk["content"])
                    keywords = [kw for kw, score in yake_keywords]
                except Exception as e:
                    print(f"[WARNING] YAKE keyword extraction failed: {e}")

                chunk_record = DocumentChunk(
                    document_id=document.id,
                    knowledge_base_id=kb.id,
                    content=chunk["content"],
                    embedding=embedding,
                    chunk_index=chunk["index"],
                    token_count=len(chunk["content"].split()),
                    metadata_={"page": 1, "doc_id": doc_id, "keywords": keywords},
                )
                db.add(chunk_record)
                total_chunks += 1
                total_tokens += chunk_record.token_count

            except Exception as e:
                print(
                    f"[ERROR] 임베딩 실패 (doc={doc_id}, chunk={chunk['index']}): {e}"
                )

        # Document 상태 업데이트
        document.status = "completed"
        document.embedding_model = embedding_model

        # 배치 커밋
        if (i + 1) % batch_size == 0:
            db.commit()
            print(f"[Index] {i + 1}/{len(documents)} 문서 처리 완료...")

    db.commit()
    print(f"[Index] 완료! 총 {total_chunks}개 청크 인덱싱됨")

    return total_chunks, total_tokens


def main():
    parser = argparse.ArgumentParser(description="RAG 평가용 문서 인덱싱")
    parser.add_argument(
        "--dataset",
        type=str,
        default="hotpotqa",
        choices=["hotpotqa", "nq", "triviaqa"],
        help="인덱싱할 데이터셋",
    )
    parser.add_argument(
        "--kb-name",
        type=str,
        default=None,
        help="Knowledge Base 이름 (기본: 'RAG Eval - {dataset}')",
    )
    parser.add_argument(
        "--user-email",
        type=str,
        default=None,
        help="사용자 이메일 (기본: 첫 번째 사용자)",
    )
    parser.add_argument(
        "--embedding-model",
        type=str,
        default="text-embedding-3-small",
        help="임베딩 모델",
    )
    parser.add_argument(
        "--max-docs", type=int, default=None, help="최대 문서 수 (None=전체)"
    )
    parser.add_argument(
        "--chunk-size", type=int, default=500, help="청크 크기 (기본값: 500)"
    )
    parser.add_argument(
        "--chunk-overlap", type=int, default=50, help="청크 중복 크기 (기본값: 50)"
    )

    args = parser.parse_args()

    # 파일 경로 결정
    dataset_dir = "tests/evaluation/datasets"
    doc_files = {
        "hotpotqa": "hotpotqa_documents.json",
        "nq": "nq_documents.json",
        "triviaqa": "triviaqa_documents.json",
    }

    doc_path = os.path.join(dataset_dir, doc_files[args.dataset])

    if not os.path.exists(doc_path):
        print(f"[ERROR] 문서 파일이 없습니다: {doc_path}")
        print("[ERROR] 먼저 prepare_datasets.py를 실행하세요:")
        print(f"  python tests/evaluation/prepare_datasets.py --dataset {args.dataset}")
        return

    # 문서 로드
    with open(doc_path, "r", encoding="utf-8") as f:
        documents = json.load(f)

    if args.max_docs:
        documents = documents[: args.max_docs]

    print("=" * 60)
    print("RAG Evaluation Document Indexing")
    print(f"Dataset: {args.dataset}")
    print(f"Documents: {len(documents)}")
    print(f"Embedding Model: {args.embedding_model}")
    print("=" * 60)

    # DB 세션
    db = SessionLocal()

    try:
        # 사용자 찾기
        if args.user_email:
            user = db.query(User).filter(User.email == args.user_email).first()
        else:
            user = db.query(User).first()

        if not user:
            print("[ERROR] 사용자를 찾을 수 없습니다.")
            return

        print(f"[User] {user.email} ({user.id})")

        # KB 이름
        kb_name = args.kb_name or f"RAG Eval - {args.dataset.upper()}"

        # KB 생성/조회
        kb = get_or_create_kb(db, user.id, kb_name, args.embedding_model)

        # 인덱싱
        chunk_count, total_tokens = asyncio.run(
            index_documents(
                db,
                kb,
                documents,
                user.id,
                chunk_size=args.chunk_size,
                chunk_overlap=args.chunk_overlap,
            )
        )

        avg_tokens = int(total_tokens / chunk_count) if chunk_count > 0 else 0

        print("\n" + "=" * 60)
        print(f"✅ Knowledge Base 생성: {kb.name}")
        print(f"Knowledge Base ID: {kb.id}")
        print(f"총 문서 수: {len(documents)}")
        print(f"총 청크 수: {chunk_count}")
        print(f"평균 청크당 토큰: {avg_tokens}")
        print("=" * 60)
        print("\n다음 단계: 평가 실행")
        print("  pytest tests/evaluation/test_rag_baseline.py::TestRAGBaseline -v")
        print(f"  (knowledge_base_id를 '{kb.id}'로 설정)")

    finally:
        db.close()


if __name__ == "__main__":
    main()
