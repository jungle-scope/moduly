"""
RAG 검색 성능 평가 프레임워크

이 모듈은 RetrievalService와 통합하여 RAG 시스템의
전체 성능을 평가하는 프레임워크를 제공합니다.

주요 기능:
- 다양한 데이터셋 로딩 (HuggingFace, JSON)
- 벤치마크 실행 및 결과 집계
- 결과 리포트 생성 및 저장

Author: Antigravity Team
Created: 2026-01-13
"""

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from tests.evaluation.rag_metrics import (
    AggregatedMetrics,
    EvaluationSample,
    RAGMetrics,
    RetrievalResult,
)


@dataclass
class EvaluationConfig:
    """평가 설정"""

    dataset_name: str
    knowledge_base_id: Optional[str] = None
    top_k_values: List[int] = None  # [1, 3, 5, 10]
    match_mode: str = "substring"  # "content", "doc_id", "substring"
    similarity_threshold: float = 0.0
    report_dir: str = "tests/evaluation/reports"
    use_rewrite: bool = False
    hybrid_search: bool = True
    use_rerank: bool = False
    use_multi_query: bool = False

    def __post_init__(self):
        if self.top_k_values is None:
            self.top_k_values = [1, 3, 5, 10]


class DatasetLoader:
    """
    평가용 데이터셋 로더

    지원 형식:
    - HuggingFace datasets
    - 로컬 JSON 파일
    - 커스텀 샘플
    """

    @staticmethod
    def load_json(filepath: str) -> List[EvaluationSample]:
        """
        JSON 파일에서 평가 샘플 로드

        예상 형식:
        [
            {
                "query": "질문 텍스트",
                "relevant_passages": ["정답1", "정답2"],
                "relevant_doc_ids": ["doc_id1"]  // optional
            }
        ]
        """
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        samples = []
        for item in data:
            samples.append(
                EvaluationSample(
                    query=item["query"],
                    relevant_passages=item.get("relevant_passages", []),
                    relevant_doc_ids=item.get("relevant_doc_ids", []),
                    metadata=item.get("metadata", {}),
                )
            )
        return samples

    @staticmethod
    def load_natural_questions(sample_count: int = 100) -> List[EvaluationSample]:
        """
        Natural Questions 데이터셋 로드 (HuggingFace)

        주의: datasets 라이브러리 필요 (pip install datasets)
        """
        try:
            from datasets import load_dataset
        except ImportError:
            raise ImportError("datasets 라이브러리가 필요합니다: pip install datasets")

        # NQ 데이터셋 로드 (validation split 사용)
        dataset = load_dataset(
            "natural_questions", split=f"validation[:{sample_count}]"
        )

        samples = []
        for item in dataset:
            # NQ 형식에서 필요한 필드 추출
            question = item.get("question", {}).get("text", "")

            # short_answers에서 정답 추출
            annotations = item.get("annotations", [])
            answers = []
            for ann in annotations:
                short_answers = ann.get("short_answers", [])
                for sa in short_answers:
                    if "text" in sa:
                        answers.append(sa["text"])

            if question and answers:
                samples.append(
                    EvaluationSample(
                        query=question,
                        relevant_passages=answers,
                        metadata={"source": "natural_questions"},
                    )
                )

        return samples

    @staticmethod
    def load_hotpotqa(sample_count: int = 100) -> List[EvaluationSample]:
        """
        HotpotQA 데이터셋 로드 (Multi-hop QA)
        """
        try:
            from datasets import load_dataset
        except ImportError:
            raise ImportError("datasets 라이브러리가 필요합니다: pip install datasets")

        dataset = load_dataset(
            "hotpot_qa", "fullwiki", split=f"validation[:{sample_count}]"
        )

        samples = []
        for item in dataset:
            question = item.get("question", "")
            answer = item.get("answer", "")

            # supporting_facts에서 관련 문서 정보 추출
            supporting_titles = item.get("supporting_facts", {}).get("title", [])

            if question and answer:
                samples.append(
                    EvaluationSample(
                        query=question,
                        relevant_passages=[answer],
                        relevant_doc_ids=supporting_titles,
                        metadata={
                            "source": "hotpotqa",
                            "type": item.get("type", ""),
                            "level": item.get("level", ""),
                        },
                    )
                )

        return samples

    @staticmethod
    def create_custom_samples() -> List[EvaluationSample]:
        """
        커스텀 테스트 샘플 생성 (데모/디버깅용)
        """
        return [
            EvaluationSample(
                query="회사의 연차 휴가 정책은 무엇인가요?",
                relevant_passages=[
                    "연차 휴가는 입사 1년 후 15일이 부여됩니다",
                    "연차휴가 15일",
                ],
                metadata={"category": "HR"},
            ),
            EvaluationSample(
                query="퇴직금 계산 방법을 알려주세요",
                relevant_passages=[
                    "퇴직금은 평균임금 × 근속연수로 계산",
                    "퇴직금 = 1일 평균임금 × 30일 × 근속연수",
                ],
                metadata={"category": "HR"},
            ),
            EvaluationSample(
                query="사내 WiFi 비밀번호가 뭔가요?",
                relevant_passages=["WiFi 비밀번호: Company2024!", "무선랜 암호"],
                metadata={"category": "IT"},
            ),
        ]


class RAGEvaluator:
    """
    RAG 검색 시스템 평가기

    사용 예:
        evaluator = RAGEvaluator(config)
        results = evaluator.evaluate(samples, retrieval_func)
        evaluator.save_report(results)
    """

    def __init__(self, config: EvaluationConfig):
        self.config = config
        self.metrics = RAGMetrics()

        # 리포트 디렉토리 생성
        os.makedirs(config.report_dir, exist_ok=True)

    def evaluate(
        self,
        samples: List[EvaluationSample],
        retrieval_func: Callable[[str, int], List[RetrievalResult]],
        progress_callback: Optional[Callable[[int, int], None]] = None,
    ) -> AggregatedMetrics:
        """
        전체 샘플에 대해 평가 수행

        Args:
            samples: 평가용 샘플 목록
            retrieval_func: 검색 함수 (query, top_k) -> List[RetrievalResult]
            progress_callback: 진행 상황 콜백 (current, total)

        Returns:
            AggregatedMetrics: 집계된 평가 결과
        """
        per_sample_results = []

        # 각 k 값에 대한 지표 누적
        metric_accumulators = {f"recall@{k}": [] for k in self.config.top_k_values}
        metric_accumulators.update(
            {f"precision@{k}": [] for k in self.config.top_k_values}
        )
        metric_accumulators.update({f"hit@{k}": [] for k in self.config.top_k_values})
        metric_accumulators.update({f"ndcg@{k}": [] for k in self.config.top_k_values})
        metric_accumulators["mrr"] = []

        max_k = max(self.config.top_k_values)

        for i, sample in enumerate(samples):
            if progress_callback:
                progress_callback(i + 1, len(samples))

            # 검색 수행
            try:
                retrieved = retrieval_func(sample.query, max_k)
            except Exception as e:
                print(
                    f"[RAGEvaluator] Error retrieving for query '{sample.query[:50]}...': {e}"
                )
                retrieved = []

            # 각 지표 계산
            sample_metrics = {}

            # MRR (k에 무관)
            mrr_result = self.metrics.mrr(retrieved, sample, self.config.match_mode)
            metric_accumulators["mrr"].append(mrr_result.value)
            sample_metrics["mrr"] = mrr_result.value

            # 각 k 값에 대한 지표
            for k in self.config.top_k_values:
                # Recall@K
                recall = self.metrics.recall_at_k(
                    retrieved, sample, k, self.config.match_mode
                )
                metric_accumulators[f"recall@{k}"].append(recall.value)
                sample_metrics[f"recall@{k}"] = recall.value

                # Precision@K
                precision = self.metrics.precision_at_k(
                    retrieved, sample, k, self.config.match_mode
                )
                metric_accumulators[f"precision@{k}"].append(precision.value)
                sample_metrics[f"precision@{k}"] = precision.value

                # Hit@K
                hit = self.metrics.hit_at_k(
                    retrieved, sample, k, self.config.match_mode
                )
                metric_accumulators[f"hit@{k}"].append(hit.value)
                sample_metrics[f"hit@{k}"] = hit.value

                # NDCG@K
                ndcg = self.metrics.ndcg_at_k(
                    retrieved, sample, k, self.config.match_mode
                )
                metric_accumulators[f"ndcg@{k}"].append(ndcg.value)
                sample_metrics[f"ndcg@{k}"] = ndcg.value

            per_sample_results.append(
                {
                    "query": sample.query,
                    "metrics": sample_metrics,
                    "retrieved_count": len(retrieved),
                }
            )

        # 평균 계산
        averaged_metrics = {}
        for metric_name, values in metric_accumulators.items():
            if values:
                averaged_metrics[metric_name] = sum(values) / len(values)
            else:
                averaged_metrics[metric_name] = 0.0

        return AggregatedMetrics(
            dataset_name=self.config.dataset_name,
            total_samples=len(samples),
            timestamp=datetime.now().isoformat(),
            config=asdict(self.config),
            metrics=averaged_metrics,
            per_sample_results=per_sample_results,
        )

    def save_report(
        self, results: AggregatedMetrics, filename: Optional[str] = None
    ) -> str:
        """
        평가 결과를 JSON 파일로 저장

        Returns:
            저장된 파일 경로
        """
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"rag_eval_{self.config.dataset_name}_{timestamp}.json"

        filepath = os.path.join(self.config.report_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(
                {**results.to_dict(), "per_sample_results": results.per_sample_results},
                f,
                indent=2,
                ensure_ascii=False,
            )

        print(f"[RAGEvaluator] Report saved to: {filepath}")
        return filepath

    def compare_reports(self, report_paths: List[str]) -> Dict[str, Any]:
        """
        여러 평가 리포트 비교

        Args:
            report_paths: 비교할 리포트 파일 경로 목록

        Returns:
            비교 결과 딕셔너리
        """
        reports = []
        for path in report_paths:
            with open(path, "r", encoding="utf-8") as f:
                reports.append(json.load(f))

        # 지표별 비교 테이블 생성
        comparison = {"reports": [], "metric_comparison": {}}

        for report in reports:
            comparison["reports"].append(
                {
                    "timestamp": report["timestamp"],
                    "dataset": report["dataset_name"],
                    "samples": report["total_samples"],
                }
            )

        # 각 지표에 대해 값 비교
        all_metrics = set()
        for report in reports:
            all_metrics.update(report.get("metrics", {}).keys())

        for metric in sorted(all_metrics):
            values = [report.get("metrics", {}).get(metric, None) for report in reports]
            comparison["metric_comparison"][metric] = values

        return comparison

    def generate_markdown_report(self, results: AggregatedMetrics) -> str:
        """
        Markdown 형식의 리포트 생성
        """
        lines = [
            "# RAG Evaluation Report",
            "",
            "## Overview",
            "",
            "| 항목 | 값 |",
            "|------|-----|",
            f"| Dataset | {results.dataset_name} |",
            f"| Samples | {results.total_samples} |",
            f"| Timestamp | {results.timestamp} |",
            f"| Match Mode | {results.config.get('match_mode', 'N/A')} |",
            "",
            "## Metrics",
            "",
            "| Metric | Value |",
            "|--------|-------|",
        ]

        for metric, value in sorted(results.metrics.items()):
            lines.append(f"| {metric} | {value:.4f} |")

        lines.extend(
            [
                "",
                "## Configuration",
                "",
                "```json",
                json.dumps(results.config, indent=2, ensure_ascii=False),
                "```",
            ]
        )

        return "\n".join(lines)
