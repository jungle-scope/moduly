"""
RAG 검색 성능 평가 지표 모듈

이 모듈은 RAG(Retrieval-Augmented Generation) 시스템의
검색 성능을 측정하기 위한 다양한 평가 지표를 제공합니다.

지원 지표:
- Recall@K: 정답이 top-k 결과에 포함된 비율
- Precision@K: top-k 결과 중 정답인 비율
- MRR (Mean Reciprocal Rank): 첫 번째 정답의 역순위 평균
- Hit@K: 정답이 top-k에 하나라도 있는지 여부
- NDCG@K: Normalized Discounted Cumulative Gain

Author: Antigravity Team
Created: 2026-01-13
"""

import json
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RetrievalResult:
    """단일 검색 결과를 표현하는 데이터 클래스"""

    content: str
    document_id: str
    similarity_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvaluationSample:
    """평가용 샘플 데이터"""

    query: str
    relevant_passages: List[str]  # 정답 passage 목록
    relevant_doc_ids: List[str] = field(default_factory=list)  # 정답 문서 ID
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MetricResult:
    """평가 지표 결과"""

    metric_name: str
    value: float
    k: Optional[int] = None
    details: Dict[str, Any] = field(default_factory=dict)


class RAGMetrics:
    """
    RAG 검색 성능 평가 지표 계산 클래스

    사용 예:
        metrics = RAGMetrics()
        recall = metrics.recall_at_k(retrieved_docs, relevant_docs, k=5)
    """

    @staticmethod
    def _is_relevant(
        retrieved: RetrievalResult,
        sample: EvaluationSample,
        match_mode: str = "content",
    ) -> bool:
        """
        검색 결과가 정답과 관련 있는지 판단

        Args:
            retrieved: 검색된 결과
            sample: 평가 샘플 (정답 포함)
            match_mode: 매칭 방식 ("content", "doc_id", "substring")
        """
        if match_mode == "doc_id":
            return retrieved.document_id in sample.relevant_doc_ids
        elif match_mode == "substring":
            # 정답 텍스트가 검색 결과에 부분 문자열로 포함되어 있는지
            return any(
                answer.lower() in retrieved.content.lower()
                for answer in sample.relevant_passages
            )
        else:  # content (정확 매칭)
            return retrieved.content in sample.relevant_passages

    def recall_at_k(
        self,
        retrieved: List[RetrievalResult],
        sample: EvaluationSample,
        k: int,
        match_mode: str = "substring",
    ) -> MetricResult:
        """
        Recall@K: 정답 중 top-k에 포함된 비율

        정의: |Relevant ∩ Retrieved@K| / |Relevant|

        Args:
            retrieved: 검색된 결과 목록 (이미 정렬됨)
            sample: 평가 샘플
            k: 상위 k개
            match_mode: 매칭 방식

        Returns:
            MetricResult with recall value
        """
        if not sample.relevant_passages:
            return MetricResult("recall", 0.0, k, {"warning": "No relevant passages"})

        top_k = retrieved[:k]
        # Recall Fix: One hit per relevant passage (not per retrieved doc)
        # Check coverage of relevant passages
        covered_passages = 0
        for passage in sample.relevant_passages:
            if any(passage.lower() in r.content.lower() for r in top_k):
                covered_passages += 1

        recall = covered_passages / len(sample.relevant_passages)

        return MetricResult(
            metric_name="recall",
            value=recall,
            k=k,
            details={
                "hits": covered_passages,
                "total_relevant": len(sample.relevant_passages),
                "retrieved_count": len(top_k),
            },
        )

    def precision_at_k(
        self,
        retrieved: List[RetrievalResult],
        sample: EvaluationSample,
        k: int,
        match_mode: str = "substring",
    ) -> MetricResult:
        """
        Precision@K: top-k 결과 중 정답인 비율

        정의: |Relevant ∩ Retrieved@K| / K
        """
        top_k = retrieved[:k]
        if not top_k:
            return MetricResult("precision", 0.0, k)

        hits = sum(1 for r in top_k if self._is_relevant(r, sample, match_mode))
        precision = hits / len(top_k)

        return MetricResult(
            metric_name="precision",
            value=precision,
            k=k,
            details={"hits": hits, "retrieved_count": len(top_k)},
        )

    def hit_at_k(
        self,
        retrieved: List[RetrievalResult],
        sample: EvaluationSample,
        k: int,
        match_mode: str = "substring",
    ) -> MetricResult:
        """
        Hit@K: 정답이 top-k에 하나라도 있으면 1, 없으면 0

        Binary metric - 하나라도 맞으면 성공
        """
        top_k = retrieved[:k]
        hit = any(self._is_relevant(r, sample, match_mode) for r in top_k)

        return MetricResult(
            metric_name="hit", value=1.0 if hit else 0.0, k=k, details={"hit": hit}
        )

    def mrr(
        self,
        retrieved: List[RetrievalResult],
        sample: EvaluationSample,
        match_mode: str = "substring",
    ) -> MetricResult:
        """
        MRR (Mean Reciprocal Rank): 첫 번째 정답의 역순위

        정의: 1 / (첫 번째 정답의 순위)

        예: 첫 정답이 3번째 → MRR = 1/3 = 0.333
        """
        for i, r in enumerate(retrieved):
            if self._is_relevant(r, sample, match_mode):
                rank = i + 1
                return MetricResult(
                    metric_name="mrr",
                    value=1.0 / rank,
                    details={"first_relevant_rank": rank},
                )

        # 정답을 찾지 못함
        return MetricResult(
            metric_name="mrr", value=0.0, details={"first_relevant_rank": None}
        )

    def ndcg_at_k(
        self,
        retrieved: List[RetrievalResult],
        sample: EvaluationSample,
        k: int,
        match_mode: str = "substring",
    ) -> MetricResult:
        """
        NDCG@K (Normalized Discounted Cumulative Gain)

        순위가 높을수록 더 큰 가중치를 부여하는 지표

        DCG = Σ (rel_i / log2(i + 1))
        NDCG = DCG / IDCG (이상적 DCG)
        """
        top_k = retrieved[:k]

        # DCG 계산
        dcg = 0.0
        for i, r in enumerate(top_k):
            rel = 1.0 if self._is_relevant(r, sample, match_mode) else 0.0
            dcg += rel / math.log2(i + 2)  # i+2 because log2(1) = 0

        # IDCG 계산 (이상적 순서: 모든 정답이 앞에)
        ideal_rels = [1.0] * min(len(sample.relevant_passages), k)
        ideal_rels.extend([0.0] * (k - len(ideal_rels)))

        idcg = 0.0
        for i, rel in enumerate(ideal_rels):
            idcg += rel / math.log2(i + 2)

        ndcg = dcg / idcg if idcg > 0 else 0.0

        return MetricResult(
            metric_name="ndcg", value=ndcg, k=k, details={"dcg": dcg, "idcg": idcg}
        )


@dataclass
class AggregatedMetrics:
    """전체 평가 데이터셋에 대한 집계 결과"""

    dataset_name: str
    total_samples: int
    timestamp: str
    config: Dict[str, Any]
    metrics: Dict[str, float]  # metric_name -> averaged value
    per_sample_results: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return {
            "dataset_name": self.dataset_name,
            "total_samples": self.total_samples,
            "timestamp": self.timestamp,
            "config": self.config,
            "metrics": self.metrics,
            "per_sample_count": len(self.per_sample_results),
        }

    def to_json(self, filepath: str):
        """결과를 JSON 파일로 저장"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    def summary(self) -> str:
        """사람이 읽기 좋은 요약 문자열"""
        lines = [
            "=" * 60,
            "RAG Evaluation Report",
            "=" * 60,
            f"Dataset: {self.dataset_name}",
            f"Samples: {self.total_samples}",
            f"Timestamp: {self.timestamp}",
            "-" * 60,
            "Metrics:",
        ]
        for name, value in sorted(self.metrics.items()):
            lines.append(f"  {name}: {value:.4f}")
        lines.append("=" * 60)
        return "\n".join(lines)
