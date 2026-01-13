"""
RAG 벤치마크 실행기

이 스크립트는 전체 RAG 평가 파이프라인을 실행합니다:
1. 데이터셋 로드
2. 검색 수행
3. 지표 계산
4. 리포트 생성

사용법:
    python tests/evaluation/run_benchmark.py \
        --kb-id YOUR_KB_ID \
        --dataset hotpotqa \
        --samples 100

Author: Antigravity Team
Created: 2026-01-13
"""

import argparse
import os
import sys
from typing import List
from uuid import UUID

# 프로젝트 루트를 path에 추가
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy.orm import Session

from apps.shared.db.models.knowledge import KnowledgeBase
from apps.shared.db.models.user import User
from apps.shared.db.session import SessionLocal
from services.retrieval import RetrievalService
from tests.evaluation.rag_evaluator import DatasetLoader, EvaluationConfig, RAGEvaluator
from tests.evaluation.rag_metrics import EvaluationSample, RetrievalResult


def run_benchmark(
    db: Session,
    user_id: UUID,
    kb_id: UUID,
    dataset_name: str,
    samples: List[EvaluationSample],
    config: EvaluationConfig,
) -> dict:
    """
    벤치마크 실행
    """
    retrieval_service = RetrievalService(db, user_id)
    evaluator = RAGEvaluator(config)

    def retrieval_func(query: str, top_k: int) -> List[RetrievalResult]:
        """RetrievalService를 래핑하는 함수"""
        try:
            chunks = retrieval_service.search_documents(
                query=query,
                knowledge_base_id=str(kb_id),
                top_k=top_k,
                threshold=0.0,  # 임계값 없이 모든 결과 반환
                use_rewrite=config.use_rewrite,  # Config에서 플래그 확인
                hybrid_search=config.hybrid_search,  # Hybrid Search Flag
                use_rerank=config.use_rerank,  # Reranking Flag
                use_multi_query=config.use_multi_query,  # [NEW] Multi-Query Flag
            )

            return [
                RetrievalResult(
                    content=c.content,
                    document_id=str(c.document_id),
                    similarity_score=c.similarity_score,
                    metadata={"filename": c.filename},
                )
                for c in chunks
            ]
        except Exception as e:
            print(f"[Benchmark] Retrieval error: {e}")
            return []

    # 진행 상황 콜백
    def progress(current: int, total: int):
        if current % 10 == 0 or current == total:
            print(
                f"[Benchmark] Progress: {current}/{total} ({100 * current / total:.1f}%)"
            )

    print(f"\n[Benchmark] 평가 시작: {len(samples)}개 샘플")
    print(f"[Benchmark] Knowledge Base: {kb_id}")
    print(f"[Benchmark] Config: {config.top_k_values}")
    print("-" * 60)

    # 평가 실행
    results = evaluator.evaluate(samples, retrieval_func, progress)

    # 리포트 저장
    report_path = evaluator.save_report(results)

    # 마크다운 리포트도 저장
    markdown = evaluator.generate_markdown_report(results)
    md_path = report_path.replace(".json", ".md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(markdown)

    print("\n" + "=" * 60)
    print(results.summary())
    print("\n리포트 저장됨:")
    print(f"  JSON: {report_path}")
    print(f"  Markdown: {md_path}")

    return results.to_dict()


def main():
    parser = argparse.ArgumentParser(description="RAG 벤치마크 실행")
    parser.add_argument(
        "--kb-id", type=str, required=True, help="Knowledge Base ID (필수)"
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default="hotpotqa",
        choices=["hotpotqa", "nq", "triviaqa", "custom"],
        help="데이터셋",
    )
    parser.add_argument("--samples", type=int, default=100, help="샘플 수")
    parser.add_argument("--user-email", type=str, default=None, help="사용자 이메일")
    parser.add_argument(
        "--top-k", type=str, default="1,3,5,10", help="평가할 top-k 값들 (쉼표 구분)"
    )
    parser.add_argument(
        "--tag",
        type=str,
        default="",
        help="리포트 태그 (예: 'baseline', 'query_rewrite')",
    )
    parser.add_argument(
        "--use-rewrite",
        action="store_true",
        help="Query Rewriting 기능 활성화",
    )
    # [NEW] Hybrid Search Arguments
    parser.add_argument(
        "--no-hybrid",
        action="store_true",
        help="Hybrid Search 비활성화 (Vector Only)",
    )
    # [NEW] Reranking Arguments
    parser.add_argument(
        "--use-rerank",
        action="store_true",
        help="Cross-Encoder Reranking 활성화",
    )
    # [NEW] Multi-Query Arguments
    parser.add_argument(
        "--use-multi-query",
        action="store_true",
        help="Multi-Query Expansion 활성화 (3개 쿼리 변형)",
    )

    args = parser.parse_args()

    # top-k 파싱
    top_k_values = [int(k.strip()) for k in args.top_k.split(",")]

    # 데이터셋 이름 설정
    dataset_tag = f"{args.dataset}_{args.tag}" if args.tag else args.dataset

    print("=" * 60)
    print("RAG Benchmark Runner")
    print("=" * 60)
    print(f"Knowledge Base: {args.kb_id}")
    print(f"Dataset: {args.dataset}")
    print(f"Samples: {args.samples}")
    print(f"Top-K: {top_k_values}")
    print(f"Query Rewrite: {'ON' if args.use_rewrite else 'OFF'}")
    print(f"Hybrid Search: {'OFF' if args.no_hybrid else 'ON'}")
    print(f"Reranking: {'ON' if args.use_rerank else 'OFF'}")
    print(f"Multi-Query: {'ON' if args.use_multi_query else 'OFF'}")
    print(f"Tag: {args.tag or '(none)'}")
    print("=" * 60)

    # 데이터셋 로드
    dataset_dir = "tests/evaluation/datasets"
    qa_files = {
        "hotpotqa": "hotpotqa_qa.json",
        "nq": "nq_qa.json",
        "triviaqa": "triviaqa_qa.json",
        "custom": "sample_qa.json",
    }

    qa_path = os.path.join(dataset_dir, qa_files[args.dataset])

    if not os.path.exists(qa_path):
        print(f"[ERROR] QA 파일이 없습니다: {qa_path}")
        print("[TIP] 먼저 prepare_datasets.py를 실행하세요:")
        print(
            f"  python tests/evaluation/prepare_datasets.py --dataset {args.dataset} --samples {args.samples}"
        )
        return

    samples = DatasetLoader.load_json(qa_path)
    samples = samples[: args.samples]

    print(f"[Dataset] {len(samples)}개 샘플 로드됨")

    # 설정
    config = EvaluationConfig(
        dataset_name=dataset_tag,
        knowledge_base_id=args.kb_id,
        top_k_values=top_k_values,
        match_mode="substring",
        report_dir="tests/evaluation/reports",
        use_rewrite=args.use_rewrite,
        hybrid_search=not args.no_hybrid,  # Default True
        use_rerank=args.use_rerank,
        use_multi_query=args.use_multi_query,  # [NEW]
    )

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

        print(f"[User] {user.email}")

        # KB 확인
        kb = (
            db.query(KnowledgeBase).filter(KnowledgeBase.id == UUID(args.kb_id)).first()
        )

        if not kb:
            print(f"[ERROR] Knowledge Base를 찾을 수 없습니다: {args.kb_id}")
            return

        print(f"[KB] {kb.name} (문서: {len(kb.documents)}개)")

        # 벤치마크 실행
        run_benchmark(db, user.id, kb.id, dataset_tag, samples, config)

    finally:
        db.close()


if __name__ == "__main__":
    main()
