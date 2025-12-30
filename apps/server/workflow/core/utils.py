"""워크플로우 노드에서 사용하는 공통 유틸리티 함수들"""

from typing import Any, List


def get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    
    Args:
        data: 검색할 데이터 (일반적으로 Dict)
        keys: 키 경로 리스트
        
    Returns:
        키 경로에 해당하는 값, 없으면 None
        
    Example:
        >>> get_nested_value({"a": {"b": "c"}}, ["a", "b"])
        "c"
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data
