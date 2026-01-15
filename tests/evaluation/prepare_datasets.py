"""
RAG 평가용 표준 데이터셋 준비 스크립트

이 스크립트는 HuggingFace의 표준 QA 데이터셋을 다운로드하고
RAG 시스템 평가를 위한 형식으로 변환합니다.

지원 데이터셋:
- HotpotQA (권장): 가볍고 Multi-hop QA에 적합
- Natural Questions: Google의 실제 검색 질문 (다운로드 오래 걸림)

사용법:
    python tests/evaluation/prepare_datasets.py --dataset hotpotqa --samples 100

Author: Antigravity Team
Created: 2026-01-13
"""

import argparse
import json
import os


def prepare_hotpotqa(
    sample_count: int = 100, output_dir: str = "tests/evaluation/datasets"
) -> str:
    """
    HotpotQA 데이터셋 준비

    HotpotQA는 Multi-hop QA 데이터셋으로, 여러 문서를 참조해야 정답을 찾을 수 있습니다.
    RAG 시스템의 복합 검색 능력을 테스트하기에 적합합니다.

    Returns:
        저장된 파일 경로
    """
    from datasets import load_dataset

    print(f"[HotpotQA] Loading {sample_count} samples...")

    # HotpotQA fullwiki split 로드
    dataset = load_dataset(
        "hotpot_qa", "fullwiki", split=f"validation[:{sample_count}]"
    )

    samples = []
    documents = []  # 인덱싱할 문서들

    for i, item in enumerate(dataset):
        question = item.get("question", "")
        answer = item.get("answer", "")

        # Supporting facts에서 문서 정보 추출
        supporting_titles = item.get("supporting_facts", {}).get("title", [])

        # Context에서 실제 문서 내용 추출
        context_titles = item.get("context", {}).get("title", [])
        context_sentences = item.get("context", {}).get("sentences", [])

        # 문서 생성
        for j, (title, sentences) in enumerate(zip(context_titles, context_sentences)):
            doc_content = " ".join(sentences)
            doc_id = f"hotpotqa_{i}_{j}"

            documents.append(
                {
                    "id": doc_id,
                    "title": title,
                    "content": doc_content,
                    "source": "hotpotqa",
                    "sample_index": i,
                }
            )

        # QA 샘플 생성
        samples.append(
            {
                "query": question,
                "relevant_passages": [answer],
                "relevant_doc_ids": supporting_titles,
                "metadata": {
                    "source": "hotpotqa",
                    "type": item.get("type", ""),
                    "level": item.get("level", ""),
                    "sample_index": i,
                },
            }
        )

    # 저장
    os.makedirs(output_dir, exist_ok=True)

    qa_path = os.path.join(output_dir, "hotpotqa_qa.json")
    docs_path = os.path.join(output_dir, "hotpotqa_documents.json")

    with open(qa_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

    with open(docs_path, "w", encoding="utf-8") as f:
        json.dump(documents, f, indent=2, ensure_ascii=False)

    print(f"[HotpotQA] Saved {len(samples)} QA samples to {qa_path}")
    print(f"[HotpotQA] Saved {len(documents)} documents to {docs_path}")

    return qa_path


def prepare_natural_questions(
    sample_count: int = 50, output_dir: str = "tests/evaluation/datasets"
) -> str:
    """
    Natural Questions 데이터셋 준비

    주의: NQ는 파일 크기가 크므로 다운로드에 시간이 걸립니다.
    처음 실행 시 ~30GB 다운로드가 필요할 수 있습니다.
    """
    from datasets import load_dataset

    print(
        f"[Natural Questions] Loading {sample_count} samples (this may take a while)..."
    )

    # NQ 데이터셋 로드 (simplified 버전 사용)
    try:
        dataset = load_dataset(
            "natural_questions", split=f"validation[:{sample_count}]"
        )
    except Exception as e:
        print(f"[Natural Questions] Error loading: {e}")
        print("[Natural Questions] Trying 'nq_open' instead...")
        dataset = load_dataset("nq_open", split=f"validation[:{sample_count}]")

    samples = []
    documents = []

    for i, item in enumerate(dataset):
        # NQ 형식에 따라 필드 추출
        if "question" in item:
            question = (
                item["question"]["text"]
                if isinstance(item["question"], dict)
                else item["question"]
            )
        else:
            continue

        # 정답 추출
        answers = []
        if "annotations" in item:
            for ann in item["annotations"]:
                for sa in ann.get("short_answers", []):
                    if "text" in sa:
                        answers.append(sa["text"])
        elif "answer" in item:
            answers = (
                item["answer"] if isinstance(item["answer"], list) else [item["answer"]]
            )

        if not question or not answers:
            continue

        # 문서 추출 (있는 경우)
        if "document" in item:
            doc = item["document"]
            doc_content = doc.get("text", "") if isinstance(doc, dict) else str(doc)
            documents.append(
                {
                    "id": f"nq_{i}",
                    "title": f"NQ Document {i}",
                    "content": doc_content[:5000],  # 너무 길면 자르기
                    "source": "natural_questions",
                }
            )

        samples.append(
            {
                "query": question,
                "relevant_passages": answers,
                "metadata": {"source": "natural_questions", "sample_index": i},
            }
        )

    # 저장
    os.makedirs(output_dir, exist_ok=True)

    qa_path = os.path.join(output_dir, "nq_qa.json")
    with open(qa_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

    print(f"[Natural Questions] Saved {len(samples)} QA samples to {qa_path}")

    if documents:
        docs_path = os.path.join(output_dir, "nq_documents.json")
        with open(docs_path, "w", encoding="utf-8") as f:
            json.dump(documents, f, indent=2, ensure_ascii=False)
        print(f"[Natural Questions] Saved {len(documents)} documents to {docs_path}")

    return qa_path


def prepare_triviaqa(
    sample_count: int = 100, output_dir: str = "tests/evaluation/datasets"
) -> str:
    """
    TriviaQA 데이터셋 준비
    """
    from datasets import load_dataset

    print(f"[TriviaQA] Loading {sample_count} samples...")

    dataset = load_dataset("trivia_qa", "rc", split=f"validation[:{sample_count}]")

    samples = []
    documents = []

    for i, item in enumerate(dataset):
        question = item.get("question", "")
        answer = item.get("answer", {})

        # 정답 추출
        if isinstance(answer, dict):
            answers = answer.get("aliases", []) + [answer.get("value", "")]
        else:
            answers = [str(answer)]

        answers = [a for a in answers if a]  # 빈 문자열 제거

        # 문서 추출
        entity_pages = item.get("entity_pages", {})
        if entity_pages:
            for j, (title, content) in enumerate(
                zip(entity_pages.get("title", []), entity_pages.get("wiki_context", []))
            ):
                documents.append(
                    {
                        "id": f"trivia_{i}_{j}",
                        "title": title,
                        "content": content[:5000],
                        "source": "triviaqa",
                    }
                )

        if question and answers:
            samples.append(
                {
                    "query": question,
                    "relevant_passages": answers,
                    "metadata": {"source": "triviaqa", "sample_index": i},
                }
            )

    # 저장
    os.makedirs(output_dir, exist_ok=True)

    qa_path = os.path.join(output_dir, "triviaqa_qa.json")
    with open(qa_path, "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

    print(f"[TriviaQA] Saved {len(samples)} samples to {qa_path}")

    if documents:
        docs_path = os.path.join(output_dir, "triviaqa_documents.json")
        with open(docs_path, "w", encoding="utf-8") as f:
            json.dump(documents, f, indent=2, ensure_ascii=False)
        print(f"[TriviaQA] Saved {len(documents)} documents")

    return qa_path


def main():
    parser = argparse.ArgumentParser(description="RAG 평가용 데이터셋 준비")
    parser.add_argument(
        "--dataset",
        type=str,
        default="hotpotqa",
        choices=["hotpotqa", "nq", "triviaqa", "all"],
        help="준비할 데이터셋",
    )
    parser.add_argument("--samples", type=int, default=100, help="샘플 수")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="tests/evaluation/datasets",
        help="출력 디렉토리",
    )

    args = parser.parse_args()

    print("=" * 60)
    print("RAG Evaluation Dataset Preparation")
    print(f"Dataset: {args.dataset}")
    print(f"Samples: {args.samples}")
    print(f"Output: {args.output_dir}")
    print("=" * 60)

    if args.dataset == "hotpotqa" or args.dataset == "all":
        prepare_hotpotqa(args.samples, args.output_dir)

    if args.dataset == "nq" or args.dataset == "all":
        prepare_natural_questions(args.samples, args.output_dir)

    if args.dataset == "triviaqa" or args.dataset == "all":
        prepare_triviaqa(args.samples, args.output_dir)

    print("\n" + "=" * 60)
    print("완료!")
    print("다음 단계: 문서를 Knowledge Base에 인덱싱하세요.")
    print("=" * 60)


if __name__ == "__main__":
    main()
