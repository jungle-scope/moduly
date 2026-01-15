"""
RAG 베이스라인 성능 평가 테스트

이 테스트는 현재 RAG 검색 시스템의 베이스라인 성능을 측정하고
개선 전/후 비교를 위한 기준점을 제공합니다.

실행 방법:
    pytest tests/evaluation/test_rag_baseline.py -v -s

Author: Antigravity Team
Created: 2026-01-13
"""

import json
import os
from datetime import datetime
from typing import List

import pytest

from tests.evaluation.rag_evaluator import DatasetLoader, EvaluationConfig, RAGEvaluator
from tests.evaluation.rag_metrics import (
    AggregatedMetrics,
    EvaluationSample,
    RAGMetrics,
    RetrievalResult,
)

# ==============================================================================
# Fixtures
# ==============================================================================


@pytest.fixture
def sample_config():
    """기본 평가 설정"""
    return EvaluationConfig(
        dataset_name="baseline_test",
        top_k_values=[1, 3, 5, 10],
        match_mode="substring",
        report_dir="tests/evaluation/reports",
    )


@pytest.fixture
def custom_samples():
    """테스트용 커스텀 샘플"""
    return DatasetLoader.create_custom_samples()


@pytest.fixture
def mock_retrieval_results():
    """Mock 검색 결과 생성기"""

    def _create_results(
        include_answer: bool = True, answer_rank: int = 1
    ) -> List[RetrievalResult]:
        results = []
        for i in range(10):
            content = f"문서 {i}의 내용입니다."
            if include_answer and i == answer_rank - 1:
                content = "연차 휴가는 입사 1년 후 15일이 부여됩니다. 회사 규정에 따라 다를 수 있습니다."

            results.append(
                RetrievalResult(
                    content=content,
                    document_id=f"doc_{i}",
                    similarity_score=0.9 - (i * 0.05),
                )
            )
        return results

    return _create_results


# ==============================================================================
# Unit Tests: RAGMetrics
# ==============================================================================


class TestRAGMetrics:
    """RAGMetrics 클래스 단위 테스트"""

    def test_recall_at_k_perfect_hit(self):
        """정답이 1위에 있을 때 Recall@1 = 1.0"""
        metrics = RAGMetrics()

        sample = EvaluationSample(
            query="연차 휴가 정책", relevant_passages=["연차 휴가 15일"]
        )

        retrieved = [
            RetrievalResult(
                content="연차 휴가 15일 부여됩니다",
                document_id="1",
                similarity_score=0.95,
            ),
            RetrievalResult(
                content="점심 시간은 12시입니다", document_id="2", similarity_score=0.8
            ),
        ]

        result = metrics.recall_at_k(retrieved, sample, k=1)
        assert result.value == 1.0
        assert result.metric_name == "recall"

    def test_recall_at_k_no_hit(self):
        """정답이 없을 때 Recall = 0.0"""
        metrics = RAGMetrics()

        sample = EvaluationSample(
            query="연차 휴가 정책", relevant_passages=["연차 휴가 15일"]
        )

        retrieved = [
            RetrievalResult(
                content="점심 시간은 12시입니다", document_id="1", similarity_score=0.95
            ),
            RetrievalResult(
                content="회의실 예약 방법", document_id="2", similarity_score=0.8
            ),
        ]

        result = metrics.recall_at_k(retrieved, sample, k=5)
        assert result.value == 0.0

    def test_mrr_first_position(self):
        """정답이 1위일 때 MRR = 1.0"""
        metrics = RAGMetrics()

        sample = EvaluationSample(query="test", relevant_passages=["정답"])

        retrieved = [
            RetrievalResult(
                content="정답 포함 문서", document_id="1", similarity_score=0.9
            ),
        ]

        result = metrics.mrr(retrieved, sample)
        assert result.value == 1.0

    def test_mrr_third_position(self):
        """정답이 3위일 때 MRR = 1/3"""
        metrics = RAGMetrics()

        sample = EvaluationSample(query="test", relevant_passages=["정답"])

        retrieved = [
            RetrievalResult(content="관련없음1", document_id="1", similarity_score=0.9),
            RetrievalResult(
                content="관련없음2", document_id="2", similarity_score=0.85
            ),
            RetrievalResult(content="정답 포함", document_id="3", similarity_score=0.8),
        ]

        result = metrics.mrr(retrieved, sample)
        assert abs(result.value - 1 / 3) < 0.001

    def test_hit_at_k(self):
        """Hit@K 테스트"""
        metrics = RAGMetrics()

        sample = EvaluationSample(query="test", relevant_passages=["정답"])

        retrieved = [
            RetrievalResult(content="관련없음", document_id="1", similarity_score=0.9),
            RetrievalResult(
                content="정답 포함", document_id="2", similarity_score=0.85
            ),
        ]

        # Hit@1 = 0 (1위에 없음)
        hit_1 = metrics.hit_at_k(retrieved, sample, k=1)
        assert hit_1.value == 0.0

        # Hit@2 = 1 (2위에 있음)
        hit_2 = metrics.hit_at_k(retrieved, sample, k=2)
        assert hit_2.value == 1.0

    def test_precision_at_k(self):
        """Precision@K 테스트"""
        metrics = RAGMetrics()

        sample = EvaluationSample(query="test", relevant_passages=["정답1", "정답2"])

        retrieved = [
            RetrievalResult(
                content="정답1 포함", document_id="1", similarity_score=0.9
            ),
            RetrievalResult(content="관련없음", document_id="2", similarity_score=0.85),
            RetrievalResult(
                content="정답2 포함", document_id="3", similarity_score=0.8
            ),
            RetrievalResult(content="관련없음", document_id="4", similarity_score=0.75),
        ]

        # Precision@4 = 2/4 = 0.5
        result = metrics.precision_at_k(retrieved, sample, k=4)
        assert result.value == 0.5


# ==============================================================================
# Unit Tests: DatasetLoader
# ==============================================================================


class TestDatasetLoader:
    """DatasetLoader 클래스 테스트"""

    def test_create_custom_samples(self):
        """커스텀 샘플 생성 테스트"""
        samples = DatasetLoader.create_custom_samples()

        assert len(samples) > 0
        assert all(isinstance(s, EvaluationSample) for s in samples)
        assert all(s.query for s in samples)
        assert all(s.relevant_passages for s in samples)

    def test_load_json(self, tmp_path):
        """JSON 로딩 테스트"""
        # 테스트 데이터 생성
        test_data = [{"query": "테스트 질문", "relevant_passages": ["정답1", "정답2"]}]

        json_path = tmp_path / "test_data.json"
        with open(json_path, "w") as f:
            json.dump(test_data, f)

        # 로드
        samples = DatasetLoader.load_json(str(json_path))

        assert len(samples) == 1
        assert samples[0].query == "테스트 질문"
        assert "정답1" in samples[0].relevant_passages


# ==============================================================================
# Integration Tests: RAGEvaluator
# ==============================================================================


class TestRAGEvaluator:
    """RAGEvaluator 통합 테스트"""

    def test_evaluate_with_mock_retrieval(self, sample_config, custom_samples):
        """Mock 검색 함수로 평가 테스트"""
        evaluator = RAGEvaluator(sample_config)

        # Mock retrieval function
        def mock_retrieval(query: str, top_k: int) -> List[RetrievalResult]:
            # 첫 번째 샘플의 정답을 포함하는 결과 반환
            if "연차" in query:
                return [
                    RetrievalResult(
                        content="연차 휴가 15일 부여",
                        document_id="1",
                        similarity_score=0.9,
                    )
                ]
            return []

        results = evaluator.evaluate(custom_samples, mock_retrieval)

        assert isinstance(results, AggregatedMetrics)
        assert results.total_samples == len(custom_samples)
        assert "recall@5" in results.metrics
        assert "mrr" in results.metrics

    def test_save_report(self, sample_config, custom_samples, tmp_path):
        """리포트 저장 테스트"""
        sample_config.report_dir = str(tmp_path)
        evaluator = RAGEvaluator(sample_config)

        # 간단한 결과 생성
        results = AggregatedMetrics(
            dataset_name="test",
            total_samples=3,
            timestamp=datetime.now().isoformat(),
            config={"test": True},
            metrics={"recall@5": 0.8, "mrr": 0.6},
        )

        filepath = evaluator.save_report(results, "test_report.json")

        assert os.path.exists(filepath)

        with open(filepath) as f:
            saved_data = json.load(f)

        assert saved_data["total_samples"] == 3
        assert saved_data["metrics"]["recall@5"] == 0.8


# ==============================================================================
# Baseline Test: 실제 시스템 통합 (Optional)
# ==============================================================================


@pytest.mark.skip(reason="실제 DB 및 LLM 연결 필요 - 수동 실행")
class TestRAGBaseline:
    """
    실제 RetrievalService와 통합하여 베이스라인 측정

    이 테스트는 실제 DB 연결과 LLM API 키가 필요합니다.
    수동으로 실행하려면: pytest -k TestRAGBaseline --runbaseline
    """

    @pytest.fixture
    def db_session(self):
        """실제 DB 세션 (구현 필요)"""
        from db.session import SessionLocal

        session = SessionLocal()
        yield session
        session.close()

    @pytest.fixture
    def retrieval_service(self, db_session):
        """실제 RetrievalService"""
        from uuid import UUID

        from apps.gateway.services.retrieval import RetrievalService

        # 테스트용 사용자 ID (실제 값으로 교체)
        user_id = UUID("00000000-0000-0000-0000-000000000000")
        return RetrievalService(db_session, user_id)

    def test_baseline_performance(self, retrieval_service):
        """베이스라인 성능 측정"""
        config = EvaluationConfig(
            dataset_name="baseline_v1",
            knowledge_base_id="YOUR_KB_ID",  # 실제 KB ID로 교체
            top_k_values=[1, 3, 5, 10],
            match_mode="substring",
        )

        # 커스텀 샘플 사용 (또는 실제 데이터셋)
        samples = DatasetLoader.create_custom_samples()

        evaluator = RAGEvaluator(config)

        def retrieval_func(query: str, top_k: int) -> List[RetrievalResult]:
            chunks = retrieval_service.search_documents(
                query=query, knowledge_base_id=config.knowledge_base_id, top_k=top_k
            )
            return [
                RetrievalResult(
                    content=c.content,
                    document_id=str(c.document_id),
                    similarity_score=c.similarity_score,
                )
                for c in chunks
            ]

        results = evaluator.evaluate(samples, retrieval_func)

        # 리포트 저장
        evaluator.save_report(results)

        # 결과 출력
        print("\n" + results.summary())

        # 최소 기준 확인 (선택)
        assert results.metrics.get("recall@5", 0) > 0.0, "Recall@5가 너무 낮음"


# ==============================================================================
# Performance Comparison Test
# ==============================================================================


class TestPerformanceComparison:
    """성능 개선 비교 테스트"""

    def test_compare_reports(self, tmp_path):
        """두 리포트 비교 테스트"""
        # 첫 번째 리포트 (베이스라인)
        report_v1 = {
            "dataset_name": "test",
            "total_samples": 100,
            "timestamp": "2026-01-13T00:00:00",
            "config": {},
            "metrics": {"recall@5": 0.65, "mrr": 0.55},
        }

        # 두 번째 리포트 (개선 후)
        report_v2 = {
            "dataset_name": "test",
            "total_samples": 100,
            "timestamp": "2026-01-14T00:00:00",
            "config": {},
            "metrics": {
                "recall@5": 0.78,  # +13% 개선
                "mrr": 0.68,  # +13% 개선
            },
        }

        # 저장
        path_v1 = tmp_path / "report_v1.json"
        path_v2 = tmp_path / "report_v2.json"

        with open(path_v1, "w") as f:
            json.dump(report_v1, f)
        with open(path_v2, "w") as f:
            json.dump(report_v2, f)

        # 비교
        config = EvaluationConfig(dataset_name="test", report_dir=str(tmp_path))
        evaluator = RAGEvaluator(config)

        comparison = evaluator.compare_reports([str(path_v1), str(path_v2)])

        assert len(comparison["reports"]) == 2

        # Recall@5 개선 확인
        recall_values = comparison["metric_comparison"]["recall@5"]
        improvement = recall_values[1] - recall_values[0]

        print(
            f"\nRecall@5 개선: {recall_values[0]:.2f} → {recall_values[1]:.2f} (+{improvement:.2f})"
        )

        assert improvement > 0, "개선이 이루어지지 않음"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
