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

        raw_data = self._extract_value_from_selector(
            self.data.source_selector, inputs
        )
        if raw_data is None:
            raise ValueError("원본 JSON 데이터를 찾을 수 없습니다.")

        if isinstance(raw_data, str):
            try:
                import json

                raw_data = json.loads(raw_data)
            except Exception as exc:
                raise ValueError("원본 JSON을 파싱할 수 없습니다.") from exc

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
