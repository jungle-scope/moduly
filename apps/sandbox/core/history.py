"""
Execution History - 코드 해시 기반 실행 시간 기록

SJF(Shortest Job First) 스케줄링을 위한 과거 실행 시간 기록 및 우선순위 추천.
동일한 코드(모듈 배포 시)는 비슷한 실행 시간을 가진다는 가정 기반.
"""
import hashlib
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, Optional

from apps.sandbox.models.job import Priority


@dataclass
class ExecutionStats:
    """코드별 실행 통계"""
    total_executions: int = 0
    total_time: float = 0.0
    min_time: float = float('inf')
    max_time: float = 0.0
    last_execution: float = field(default_factory=time.time)
    
    @property
    def avg_time(self) -> float:
        if self.total_executions == 0:
            return 0.0
        return self.total_time / self.total_executions
    
    def record(self, execution_time: float):
        """실행 시간 기록"""
        self.total_executions += 1
        self.total_time += execution_time
        self.min_time = min(self.min_time, execution_time)
        self.max_time = max(self.max_time, execution_time)
        self.last_execution = time.time()


class ExecutionHistory:
    """
    코드 해시 기반 실행 기록 관리
    
    사용법:
        history = ExecutionHistory()
        
        # 우선순위 추천
        priority = history.suggest_priority(code)
        
        # 실행 후 기록
        history.record(code, execution_time)
    """
    
    # 우선순위 결정 임계값 (초)
    FAST_THRESHOLD = 0.5   # 0.5초 미만 → HIGH
    SLOW_THRESHOLD = 2.0   # 2초 초과 → LOW
    
    def __init__(self, max_entries: int = 10000):
        self._stats: Dict[str, ExecutionStats] = defaultdict(ExecutionStats)
        self._max_entries = max_entries
    
    @staticmethod
    def _hash_code(code: str) -> str:
        """코드를 해시로 변환"""
        return hashlib.md5(code.encode()).hexdigest()
    
    def record(self, code: str, execution_time: float):
        """실행 시간 기록"""
        code_hash = self._hash_code(code)
        self._stats[code_hash].record(execution_time)
        
        # 메모리 제한: 오래된 항목 정리
        if len(self._stats) > self._max_entries:
            self._cleanup_old_entries()
    
    def get_avg_time(self, code: str) -> Optional[float]:
        """코드의 평균 실행 시간 조회 (기록 없으면 None)"""
        code_hash = self._hash_code(code)
        if code_hash not in self._stats:
            return None
        stats = self._stats[code_hash]
        if stats.total_executions == 0:
            return None
        return stats.avg_time
    
    def suggest_priority(self, code: str, fallback: Priority = Priority.NORMAL) -> Priority:
        """
        과거 실행 기록 기반 우선순위 추천
        
        Args:
            code: 실행할 코드
            fallback: 기록이 없을 때 기본값
        
        Returns:
            추천 우선순위 (HIGH/NORMAL/LOW)
        """
        avg_time = self.get_avg_time(code)
        
        # 기록 없음 → 기본값 사용
        if avg_time is None:
            return fallback
        
        # SJF 원칙: 짧은 작업 우선
        if avg_time < self.FAST_THRESHOLD:
            return Priority.HIGH
        elif avg_time > self.SLOW_THRESHOLD:
            return Priority.LOW
        else:
            return Priority.NORMAL
    
    def get_stats(self, code: str) -> Optional[ExecutionStats]:
        """코드의 상세 통계 조회"""
        code_hash = self._hash_code(code)
        if code_hash in self._stats:
            return self._stats[code_hash]
        return None
    
    def _cleanup_old_entries(self):
        """오래된 항목 정리 (LRU 방식)"""
        if len(self._stats) <= self._max_entries:
            return
        
        # 마지막 실행 시간 기준 정렬 후 오래된 것 제거
        sorted_hashes = sorted(
            self._stats.keys(),
            key=lambda h: self._stats[h].last_execution
        )
        
        # 25% 제거
        remove_count = len(sorted_hashes) // 4
        for code_hash in sorted_hashes[:remove_count]:
            del self._stats[code_hash]
    
    @property
    def total_entries(self) -> int:
        return len(self._stats)
