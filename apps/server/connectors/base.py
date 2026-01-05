# 모든 커넥터의 규칙 (Base Class)

from abc import ABC, abstractmethod


class BaseConnector(ABC):
    @abstractmethod
    def check(self, config: dict) -> bool:
        """연결이 잘 되는지 확인하는 규칙"""
        pass

    @abstractmethod
    def get_schema_info(self, config: dict) -> list:
        """
        테이블과 컬럼 정보를 상세 조회하는 규칙
        Returns:
            [
                {
                    "table_name": "users",
                    "columns": [
                        {"name": "id", "type": "integer"},
                        {"name": "email", "type": "varchar"}
                    ]
                }
            ]
        """
        pass

    @abstractmethod
    def fetch_data(self, config: dict, query: str, batch_size: int = 1000):
        """
        임의의 쿼리 결과 데이터를 배치 단위로 가져오는 규칙
        Returns:
            Generator[Dict[str, Any]]: 컬럼명과 값이 매핑된 딕셔너리 리스트 (yield)
        """
        pass
