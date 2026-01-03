# 모든 커넥터의 규칙 (Base Class)

from abc import ABC, abstractmethod


class BaseConnector(ABC):
    @abstractmethod
    def check(self, config: dict) -> bool:
        """연결이 잘 되는지 확인하는 규칙"""
        pass

    @abstractmethod
    def discover(self, config: dict) -> list:
        """테이블 목록을 가져오는 규칙"""
        pass

    @abstractmethod
    def read(
        self, config: dict, table_name: str, batch_size: int = 1000, last_synced_at=None
    ):
        """데이터를 배치 단위로 조금씩 읽어오는 규칙. 마지막 인자가 있으면 그 이후 데이터만 가져옵니다"""
        pass
