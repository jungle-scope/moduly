"""
JOIN 쿼리 생성 유틸리티
2개 테이블 JOIN 쿼리를 자동 생성합니다.
"""

from typing import Any, Dict, List


def generate_join_query(
    selections: List[Dict[str, Any]], join_config: Dict[str, Any], limit: int = 1000
) -> str:
    """
    2테이블 LEFT JOIN 쿼리 생성

    Args:
        selections: [
            {"table_name": "orders", "columns": ["id", "user_id", "price"]},
            {"table_name": "users", "columns": ["id", "name"]}
        ]
        join_config: {
            "base_table": "orders",
            "joins": [{
                "from_table": "orders",
                "to_table": "users",
                "from_column": "user_id",
                "to_column": "id"
            }]
        }
        limit: LIMIT 절 값

    Returns:
        SELECT orders.id AS orders__id, ...
        FROM orders
        LEFT JOIN users ON orders.user_id = users.id
        LIMIT 1000
    """
    base_table = join_config["base_table"]
    joins = join_config.get("joins", [])

    # SELECT 절: 테이블명__컬럼명 형식으로 alias
    select_parts = []
    for sel in selections:
        table = sel["table_name"]
        for col in sel["columns"]:
            select_parts.append(f"{table}.{col} AS {table}__{col}")

    select_clause = ",\n        ".join(select_parts)

    # JOIN 절
    join_clauses = []
    for join in joins:
        join_clauses.append(
            f"LEFT JOIN {join['to_table']} "
            f"ON {join['from_table']}.{join['from_column']} = "
            f"{join['to_table']}.{join['to_column']}"
        )

    join_clause = "\n    ".join(join_clauses)

    query = f"""
        SELECT 
            {select_clause}
        FROM {base_table}
        {join_clause}
        LIMIT {limit}
    """

    return query.strip()


def convert_to_namespace(row_dict: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Flat dictionary를 네임스페이스 구조로 변환

    Args:
        row_dict: {"orders__id": 1, "users__name": "홍길동"}

    Returns:
        {"orders": {"id": 1}, "users": {"name": "홍길동"}}
    """
    result = {}
    for key, value in row_dict.items():
        if "__" in key:
            table, col = key.split("__", 1)
            if table not in result:
                result[table] = {}
            result[table][col] = value
        else:
            # __ 없는 경우는 그대로 (일반 모드와의 호환성)
            result[key] = value
    return result
