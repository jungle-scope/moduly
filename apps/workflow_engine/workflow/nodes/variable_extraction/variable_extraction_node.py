import ast
import json
import re
from typing import Any, Dict, List, Optional

from apps.workflow_engine.workflow.nodes.base.node import Node
from apps.workflow_engine.workflow.nodes.variable_extraction.entities import (
    VariableExtractionNodeData,
)

# =============================================================================
# 변수 추출 노드
# LLM, 코드, HTTP 등 다양한 노드의 JSON 출력에서 특정 값을 추출합니다.
# =============================================================================


class VariableExtractionNode(Node[VariableExtractionNodeData]):
    """
    JSON 데이터에서 지정한 경로의 값을 추출해 변수로 반환하는 노드.

    사용 예시:
        - LLM 노드의 JSON 응답에서 특정 키 추출
        - 코드 노드의 dict 반환값에서 중첩된 값 추출
        - HTTP 요청 노드의 API 응답에서 데이터 추출

    지원하는 경로 형식:
        - 단순 키: "name"
        - 중첩 키: "user.name", "data.result.count"
        - 배열 인덱스: "items[0]", "users[2].name"
        - 혼합: "data.items[0].value"
    """

    node_type = "variableExtractionNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        source_selector로 원본 데이터를 찾고, mappings에 정의된 경로로 값을 추출합니다.

        Args:
            inputs: 이전 노드들의 출력 결과

        Returns:
            추출된 변수들의 딕셔너리 {변수명: 값}

        Raises:
            ValueError: 원본 데이터를 찾을 수 없거나 파싱 실패 시
        """
        # 입력 검증
        if not self.data.source_selector or len(self.data.source_selector) < 2:
            raise ValueError("원본 JSON 입력을 선택해주세요.")

        # 원본 데이터 추출
        raw_data = self._extract_value_from_selector(self.data.source_selector, inputs)
        if raw_data is None:
            raise ValueError("원본 JSON 데이터를 찾을 수 없습니다.")

        # 문자열인 경우 JSON 파싱 시도
        if isinstance(raw_data, str):
            try:
                raw_data = self._safe_parse_json(raw_data)
            except Exception as exc:
                raise ValueError(f"원본 JSON을 파싱할 수 없습니다: {exc}") from exc

        # dict 또는 list만 허용
        if not isinstance(raw_data, (dict, list)):
            raise ValueError("원본 JSON이 객체 또는 배열 형식이 아닙니다.")

        # 매핑에 따라 값 추출
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
        self, selector: List[str], inputs: Dict[str, Any]
    ) -> Optional[Any]:
        """
        source_selector 배열로부터 실제 데이터를 추출합니다.

        Args:
            selector: [노드ID, 출력키] 형태의 리스트
            inputs: 이전 노드들의 출력 결과

        Returns:
            추출된 데이터 또는 None
        """
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

        Args:
            data: 검색할 dict 또는 list
            path: 경로 문자열 (예: "user.name", "items[0].id")

        Returns:
            추출된 값 또는 None (경로가 존재하지 않는 경우)

        지원 형식:
            - key.subkey: 중첩 객체
            - array[0]: 배열 인덱스
            - array[0].key: 배열 + 중첩
            - [0]: 직접 배열 인덱스 (루트가 배열인 경우)
        """
        try:
            keys = path.split(".")
            current = data

            for key in keys:
                if not key:
                    continue

                # 배열 인덱스 패턴 매칭: key[0] 또는 [0]
                array_match = re.match(r"^(.*)?\[(\d+)\]$", key)

                if array_match:
                    key_name = array_match.group(1)
                    index = int(array_match.group(2))

                    # key_name이 있으면 먼저 해당 키로 접근
                    if key_name:
                        if isinstance(current, dict) and key_name in current:
                            current = current[key_name]
                        else:
                            return None

                    # 배열 인덱스 접근
                    if isinstance(current, list) and 0 <= index < len(current):
                        current = current[index]
                    else:
                        return None
                else:
                    # 일반 키 접근
                    if isinstance(current, dict) and key in current:
                        current = current[key]
                    else:
                        return None

            return current
        except Exception:
            return None

    # =========================================================================
    # JSON 파싱 로직
    # LLM 출력 등 더러운 JSON을 안전하게 파싱하는 전처리 파이프라인
    # =========================================================================

    def _safe_parse_json(self, raw_data: str) -> Any:
        """
        LLM 응답 등에서 더럽게 들어오는 JSON을 안전하게 파싱합니다.

        처리 순서:
        1. 전처리 (Markdown 블록, 주석, trailing comma 등)
        2. 표준 JSON 파싱
        3. ast.literal_eval 시도 (Python dict 리터럴)
        4. 복구 로직 (키 따옴표, 숫자 형식 등)
        """

        # 전처리 파이프라인
        cleaned = raw_data.strip()
        cleaned = self._strip_markdown_block(cleaned)
        cleaned = self._strip_comments(cleaned)
        cleaned = self._fix_trailing_comma(cleaned)

        # 1. 표준 JSON 시도
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # 2. ast.literal_eval 시도 (작은따옴표, Python dict 리터럴)
        try:
            result = ast.literal_eval(cleaned)
            if isinstance(result, (dict, list)):
                return result
        except (ValueError, SyntaxError):
            pass

        # 3. 복구 로직 시작
        repaired = cleaned

        # 외부 {} 누락 처리
        if not repaired.startswith("{") and not repaired.startswith("["):
            if ":" in repaired:
                repaired = "{" + repaired + "}"

        # 키 따옴표 복구
        repaired = self._fix_unquoted_keys(repaired)

        # 숫자 형식 복구
        repaired = self._fix_number_format(repaired)

        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # 4. 작은따옴표 → 큰따옴표 (문자열 외부만)
        repaired = self._convert_single_to_double_quotes(repaired)

        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # 5. 마지막으로 literal_eval 재시도
        try:
            result = ast.literal_eval(repaired)
            if isinstance(result, (dict, list)):
                return result
        except (ValueError, SyntaxError):
            pass

        # 모든 시도 실패 시 원래 에러 메시지 반환
        return json.loads(raw_data)

    def _strip_markdown_block(self, data: str) -> str:
        """
        Markdown 코드 블록 제거 (```json ... ``` 또는 ``` ... ```)
        """
        # ```json 또는 ``` 로 시작하고 ``` 로 끝나는 패턴
        pattern = r"^```(?:json|JSON)?\s*\n?(.*?)\n?```$"
        match = re.match(pattern, data.strip(), re.DOTALL)
        if match:
            return match.group(1).strip()
        return data

    def _strip_comments(self, data: str) -> str:
        """
        JSON 내 주석 제거 (// 한 줄 주석, /* */ 블록 주석)
        주의: 문자열 내부의 // 는 건드리지 않도록 주의 필요
        """
        # 블록 주석 제거 /* ... */
        data = re.sub(r"/\*.*?\*/", "", data, flags=re.DOTALL)

        # 한 줄 주석 제거 (문자열 외부만) - 간단한 휴리스틱
        # 완벽하지 않지만 대부분의 케이스 커버
        lines = []
        for line in data.split("\n"):
            # 문자열 밖의 // 만 제거 (따옴표 개수로 판단하는 간단한 방식)
            in_string = False
            result_chars = []
            i = 0
            while i < len(line):
                char = line[i]

                if char == '"' and (i == 0 or line[i - 1] != "\\"):
                    in_string = not in_string
                    result_chars.append(char)
                elif (
                    not in_string
                    and char == "/"
                    and i + 1 < len(line)
                    and line[i + 1] == "/"
                ):
                    # 주석 시작, 나머지 줄 무시
                    break
                else:
                    result_chars.append(char)
                i += 1

            lines.append("".join(result_chars))

        return "\n".join(lines)

    def _fix_trailing_comma(self, data: str) -> str:
        """
        Trailing comma 제거 (,} 또는 ,])
        """
        # ,} 또는 ,] 앞의 콤마 제거 (공백 포함)
        data = re.sub(r",\s*}", "}", data)
        data = re.sub(r",\s*]", "]", data)
        return data

    def _fix_unquoted_keys(self, data: str) -> str:
        """
        따옴표 없는 키에 따옴표 추가 (key: value → "key": value)
        """
        # { 또는 , 뒤에 오는 식별자 + 콜론 패턴
        pattern = r"([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:"
        return re.sub(pattern, r'\1"\2":', data)

    def _fix_number_format(self, data: str) -> str:
        """
        비표준 숫자 형식 복구 (.5 → 0.5, 1. → 1.0)
        """
        # .5 → 0.5 (숫자 앞에 0 추가)
        data = re.sub(r"(?<![0-9])\.([0-9]+)", r"0.\1", data)

        # 1. → 1.0 (소수점 뒤에 0 추가)
        data = re.sub(r"([0-9]+)\.(?![0-9])", r"\1.0", data)

        return data

    def _convert_single_to_double_quotes(self, data: str) -> str:
        """
        작은따옴표를 큰따옴표로 변환 (간단한 케이스만)
        주의: 문자열 내부의 따옴표 처리는 불완전할 수 있음
        """
        # 키의 작은따옴표 변환: {'key' → {"key"
        data = re.sub(r"([{,]\s*)'([^']+)'(\s*:)", r'\1"\2"\3', data)

        # 값의 작은따옴표 변환: : 'value' → : "value"
        data = re.sub(r"(:\s*)'([^']*)'(\s*[,}\]])", r'\1"\2"\3', data)

        return data
