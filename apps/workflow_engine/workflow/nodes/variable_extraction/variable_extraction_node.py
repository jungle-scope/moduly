from typing import Any, Dict, Optional

from apps.workflow_engine.workflow.nodes.base.node import Node
from apps.workflow_engine.workflow.nodes.variable_extraction.entities import (
    VariableExtractionNodeData,
)


class VariableExtractionNode(Node[VariableExtractionNodeData]):
    """
    JSON 데이터에서 지정한 경로의 값을 추출해 변수로 반환하는 노드
    """

    node_type = "variableExtractionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        source_selector로 원본 JSON을 찾고, mappings에 정의된 json_path로 값을 추출합니다.
        키가 없으면 None을 반환합니다.
        """
        if not self.data.source_selector or len(self.data.source_selector) < 2:
            raise ValueError("원본 JSON 입력을 선택해주세요.")

        raw_data = self._extract_value_from_selector(self.data.source_selector, inputs)
        if raw_data is None:
            raise ValueError("원본 JSON 데이터를 찾을 수 없습니다.")

        if isinstance(raw_data, str):
            try:
                # 다양한 JSON 형식을 처리하기 위해 안전한 파싱 시도
                raw_data = self._safe_parse_json(raw_data)
            except Exception as exc:
                raise ValueError(f"원본 JSON을 파싱할 수 없습니다: {exc}") from exc

        if not isinstance(raw_data, (dict, list)):
            raise ValueError("원본 JSON이 객체 또는 배열 형식이 아닙니다.")

        results: Dict[str, Any] = {}
        for mapping in self.data.mappings:
            if not mapping.name:
                continue
            if not mapping.json_path:
                results[mapping.name] = None
                continue
            results[mapping.name] = self._extract_value(raw_data, mapping.json_path)

        return results

    def _extract_value_from_selector(
        self, selector: list[str], inputs: Dict[str, Any]
    ) -> Optional[Any]:
        if not selector:
            return None

        target_node_id = selector[0]
        source_data = inputs.get(target_node_id)
        if source_data is None:
            return None

        if len(selector) > 1:
            if isinstance(source_data, dict):
                return source_data.get(selector[1])
            return None

        return source_data

    def _extract_value(self, data: Any, path: str) -> Any:
        """
        JSON 경로 문자열을 파싱하여 값을 추출합니다.
        지원 형식: key.subkey, array[0], array[0].key
        """
        import re

        try:
            keys = path.split(".")
            current = data

            for key in keys:
                match = re.match(r"(.+)\[(\d+)\]$", key)
                if match:
                    key_name = match.group(1)
                    index = int(match.group(2))

                    if isinstance(current, dict) and key_name in current:
                        current = current[key_name]
                        if isinstance(current, list) and 0 <= index < len(current):
                            current = current[index]
                        else:
                            return None
                    else:
                        return None
                else:
                    if isinstance(current, dict) and key in current:
                        current = current[key]
                    else:
                        return None

            return current
        except Exception:
            return None

    def _safe_parse_json(self, raw_data: str) -> Any:
        """
        다양한 형식의 JSON 문자열을 안전하게 파싱합니다.
        지원 형식:
        1. 표준 JSON
        2. 작은따옴표 사용 (Python dict str)
        3. 외부 중괄호 누락 (key: value, ...)
        4. 키에 따옴표 누락 (key: "value")
        """
        import ast
        import json
        import re

        raw_data = raw_data.strip()

        # 1. 표준 JSON 시도
        try:
            return json.loads(raw_data)
        except json.JSONDecodeError:
            pass

        # 2. ast.literal_eval 시도 (작은따옴표 처리 등 Python dict 리터럴과 유사한 경우)
        try:
            # 안전을 위해 dict나 list 구조만 허용하는 것이 좋으나,
            # literal_eval은 기본적으로 리터럴만 평가하므로 비교적 안전함
            result = ast.literal_eval(raw_data)
            if isinstance(result, (dict, list)):
                return result
        except (ValueError, SyntaxError):
            pass

        # 복구 로직 시작
        repaired_data = raw_data

        # 3. 외부 중괄호 누락 처리
        # { 로 시작하지 않는데 : 가 포함되어 있다면 중괄호로 감싸보기
        if not repaired_data.startswith("{") and ":" in repaired_data:
            repaired_data = "{" + repaired_data + "}"

        try:
            return json.loads(repaired_data)
        except json.JSONDecodeError:
            pass

        # 4. 키에 따옴표 누락 처리 (key: -> "key":)
        # 매우 단순화된 정규식으로, 문자열 내의 콜론 등을 잘못 건드릴 위험이 있음.
        # 따라서 최대한 보수적으로: 공백이나 콤마/중괄호 뒤에 오는 식별자 + 콜론 패턴 매칭
        # 예: { key: ... , next: ... }
        # 패턴: (문자열시작|콤마|중괄호앞공백)([a-zA-Z0-9_]+)\s*:

        # 정규식 설명:
        # (?<=\{|\,)\s* : { 또는 , 뒤에 공백이 0개 이상 (lookbehind)
        # ([a-zA-Z_][a-zA-Z0-9_]*)\s*: : 식별자(키) 뒤에 콜론
        # 주의: lookbehind는 고정 길이여야 하므로 다른 방식 사용.

        # 키 따옴표 누락 복구 시도 (re.sub with function)
        # a: 1, b: 2 -> "a": 1, "b": 2
        repaired_keys = re.sub(
            r"([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', repaired_data
        )

        try:
            return json.loads(repaired_keys)
        except json.JSONDecodeError:
            pass

        # 5. ast.literal_eval이 실패했고 json.loads도 실패했을 때,
        # 작은 따옴표를 큰 따옴표로 변환하여 JSON 파싱 시도 (단순 치환은 위험할 수 있음)
        # 하지만 위에서 literal_eval을 이미 시도했으므로, 여기서는
        # 혼합된 경우(키는 따옴표 없음, 값은 작은따옴표 등)를 고려해볼 수 있음.
        # 여기서는 너무 복잡한 복구보다는, 마지막 시도로 작은따옴표 -> 큰따옴표 치환만 수행

        # 주의: 문자열 내부의 작은따옴표도 바뀔 수 있음 'I\'m' -> "I\"m" 처리가 필요
        # 단순 치환은 위험하므로 생략하거나 매우 신중해야 함.
        # 대신, 키 복구된 문자열(repaired_keys)에 대해 literal_eval 재시도
        try:
            result = ast.literal_eval(repaired_keys)
            if isinstance(result, (dict, list)):
                return result
        except (ValueError, SyntaxError):
            pass

        # 모든 시도 실패 시 원래의 에러 메시지를 위해 마지막으로 json.loads 시도하여 예외 발생시키기
        return json.loads(raw_data)
