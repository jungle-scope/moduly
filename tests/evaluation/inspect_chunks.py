import argparse
import os
import random
import sys
from uuid import UUID

# 프로젝트 루트를 path에 추가
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from apps.shared.db.models.knowledge import Document, DocumentChunk, KnowledgeBase
from apps.shared.db.session import SessionLocal


def inspect_data(kb_id_str: str, sample_size: int = 5):
    db = SessionLocal()
    try:
        kb_id = UUID(kb_id_str)
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
        if not kb:
            print(f"[ERROR] KB not found: {kb_id}")
            return

        print(f"🔍 Inspecting Knowledge Base: {kb.name} ({kb.id})")

        # 전체 청크 수 확인
        total_chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.knowledge_base_id == kb.id)
            .count()
        )
        print(f"📊 Total Chunks: {total_chunks}")

        if total_chunks == 0:
            print("⚠️ No chunks found.")
            return

        # 랜덤 샘플링
        # Note: 대량 데이터에서는 LIMIT/OFFSET 방식이 느릴 수 있지만, 디버깅용으로는 충분
        indices = random.sample(range(total_chunks), min(sample_size, total_chunks))

        print(f"\n📝 Showing {len(indices)} random samples:\n")

        for idx, offset_i in enumerate(indices):
            chunk = (
                db.query(DocumentChunk)
                .filter(DocumentChunk.knowledge_base_id == kb.id)
                .offset(offset_i)
                .first()
            )
            if not chunk:
                continue

            doc = db.query(Document).filter(Document.id == chunk.document_id).first()
            title = (
                doc.meta_info.get("title", "No Title")
                if doc and doc.meta_info
                else "Unknown"
            )

            print("-" * 60)
            print(f"Sample #{idx + 1}")
            print(f"📄 Document: {title}")
            print(f"🔢 Token Count: {chunk.token_count} (Estimated)")
            print(f"📏 Char Length: {len(chunk.content)}")
            print("-" * 20 + " [Content Start] " + "-" * 20)
            print(chunk.content[:500] + ("..." if len(chunk.content) > 500 else ""))
            print("-" * 20 + " [Content End] " + "-" * 22)
            print("\n")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inspect RAG Knowledge Base Content")
    parser.add_argument(
        "--kb-id", type=str, required=True, help="Knowledge Base ID to inspect"
    )
    parser.add_argument(
        "--samples", type=int, default=5, help="Number of samples to show"
    )

    args = parser.parse_args()
    inspect_data(args.kb_id, args.samples)
