from typing import Any, Dict, List, Literal, Optional

from jinja2 import BaseLoader, Environment, TemplateSyntaxError, UndefinedError
from pydantic import BaseModel, Field

from apps.workflow_engine.workflow.nodes.base.entities import BaseNodeData
from apps.workflow_engine.workflow.nodes.base.node import Node


class LoopNodeInput(BaseModel):
    """Loop Node 입력 변수 정의"""

    name: str
    value_selector: List[str] = Field(
        default_factory=list, description="[node_id, variable_key]"
    )


class LoopNodeData(BaseNodeData):
    """Loop Node 데이터 스키마"""

    loop_key: str = Field(default="", description="반복 대상 배열 변수의 키")
    max_iterations: Optional[int] = Field(default=100, description="최대 반복 횟수")

    inputs: List[LoopNodeInput] = Field(
        default_factory=list, description="루프 내부로 전달할 입력 변수 매핑"
    )
    outputs: List[LoopNodeInput] = Field(
        default_factory=list, description="루프 외부로 전달할 출력 변수 매핑"
    )

    parallel_mode: bool = Field(False, description="병렬 실행 모드 여부")
    error_strategy: Literal["end", "continue"] = Field(
        "end", description="에러 발생 시 처리 전략"
    )
    flatten_output: bool = Field(True, description="출력 결과 평탄화 여부")

    subGraph: Optional[Dict[str, Any]] = Field(
        None, description="루프 내부 서브 그래프 (Nodes, Edges)"
    )


class LoopNode(Node[LoopNodeData]):
    """
    Loop Node (Hybrid Approach)

    템플릿 문법과 명시적 매핑을 모두 지원합니다.
    - 템플릿 문법: {{node_id.variable}}, {{loop.item}}, {{loop.index}}
    - 암시적 접근: inputs 배열이 비어있으면 모든 외부 변수 자동 전달
    - 명시적 매핑: inputs 배열로 선택적 매핑 가능
    """

    node_type = "loopNode"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Jinja2 환경 초기화
        self.jinja_env = Environment(
            loader=BaseLoader(),
            autoescape=False,  # 자동 이스케이프 비활성화
        )

    def _get_entry_point_ids(self) -> List[str]:
        """
        서브그래프의 진입점(Input Edge가 없는 노드) ID 목록 반환
        """
        nodes = self.data.subGraph.get("nodes", [])
        edges = self.data.subGraph.get("edges", [])

        target_nodes = {edge.get("target") for edge in edges}
        entry_nodes = [
            node.get("id") for node in nodes if node.get("id") not in target_nodes
        ]
        return entry_nodes

    def _render_template(self, template: str, context: Dict[str, Any]) -> Any:
        """
        Jinja2 템플릿 렌더링
        {{node_id.variable}} 형식 지원
        """
        if not isinstance(template, str):
            return template

        # 템플릿 문법이 없으면 그대로 반환
        if "{{" not in template:
            return template

        try:
            tmpl = self.jinja_env.from_string(template)
            result = tmpl.render(context)
            return result
        except (TemplateSyntaxError, UndefinedError):
            # 템플릿 오류 시 원본 반환 또는 에러
            return template

    def _create_subgraph_engine(self, context: Dict[str, Any]):
        """
        서브그래프 실행을 위한 WorkflowEngine 생성 (중복 제거)
        """
        from workflow.core.workflow_engine import WorkflowEngine

        entry_point_ids = self._get_entry_point_ids()

        return WorkflowEngine(
            graph={
                "nodes": self.data.subGraph["nodes"],
                "edges": self.data.subGraph.get("edges", []),
            },
            user_input=context,
            execution_context=self.execution_context.copy(),
            is_deployed=False,
            db=self.execution_context.get("db"),
            workflow_timeout=300,
            is_subworkflow=True,
            entry_point_ids=entry_point_ids,
        )

    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Loop Node 실행 로직 (개선된 방식)
        - 병렬 실행 지원
        - 에러 핸들링 강화
        - 컨텍스트 주입 개선
        """

        # 1. 서브그래프 검증
        if not self.data.subGraph or not self.data.subGraph.get("nodes"):
            return {"error": "No subgraph defined", "results": []}

        # 2. 하이브리드 입력 매핑
        mapped_inputs = self._map_inputs_hybrid(inputs)

        # 3. 반복 대상 배열 가져오기
        array_to_iterate = self._get_iteration_array(inputs, mapped_inputs)

        if not isinstance(array_to_iterate, list):
            return {"error": "Loop target is not an array", "results": []}

        # 4. 반복 실행 설정
        max_iterations = self.data.max_iterations or 100
        # 최대 반복 횟수 제한 (배열 길이 vs 설정값)
        array_to_iterate = array_to_iterate[:max_iterations]

        results = [None] * len(array_to_iterate)  # 순서 보장을 위한 초기화

        # 5. 병렬/순차 실행 분기
        if self.data.parallel_mode:
            await self._run_parallel(array_to_iterate, inputs, results)
        else:
            await self._run_sequential(array_to_iterate, inputs, results)

        # 6. 출력 변수 매핑 및 결과 반환
        output = self._map_outputs_hybrid(results, inputs)
        return output

    async def _run_sequential(
        self, array: List[Any], inputs: Dict[str, Any], results: List[Any]
    ):
        """순차 실행 모드"""
        iteration_count = 0
        for i, item in enumerate(array):
            try:
                context = self._build_variable_context(inputs, item=item, index=i)
                # 서브그래프 실행 (스코프 기반)
                result = await self._execute_subgraph_scoped(context)
                results[i] = result
            except Exception as e:
                self._handle_iteration_error(e, results, i)

            iteration_count += 1

    async def _run_parallel(
        self, array: List[Any], inputs: Dict[str, Any], results: List[Any]
    ):
        """병렬 실행 모드"""
        import asyncio

        # 동시 실행 제한 (Semaphore) - 기본값 4, 필요시 환경변수나 설정으로 뺄 수 있음
        max_concurrency = 4
        semaphore = asyncio.Semaphore(max_concurrency)

        async def _worker(index: int, item: Any):
            async with semaphore:
                try:
                    # 각 워커마다 별도의 컨텍스트 생성 (스레드/태스크 안전)
                    context = self._build_variable_context(
                        inputs, item=item, index=index
                    )
                    # 독립된 엔진 생성 및 실행
                    subgraph_engine = self._create_subgraph_engine(context)
                    result = await subgraph_engine.execute()
                    results[index] = result

                except Exception as e:
                    self._handle_iteration_error(e, results, index)

        # 모든 태스크 생성 및 실행
        tasks = [_worker(i, item) for i, item in enumerate(array)]
        if tasks:
            await asyncio.gather(*tasks)

    def _handle_iteration_error(self, error: Exception, results: List[Any], index: int):
        """반복 중 에러 처리"""
        if self.data.error_strategy == "end":
            raise error
        elif self.data.error_strategy == "continue":
            # 에러 정보 기록
            results[index] = {"error": str(error), "status": "failed"}

    def _build_variable_context(
        self, inputs: Dict[str, Any], item: Any = None, index: int = None
    ) -> Dict[str, Any]:
        """
        [개선] 모든 외부 노드 출력 + Loop 변수를 포함한 컨텍스트 생성
        - loop.item, loop.index 외에 item, index 직접 접근 지원
        """
        context = {}

        # 1. 외부 노드 출력 모두 포함 (루트 레벨)
        for node_id, node_output in inputs.items():
            context[node_id] = node_output

        # 2. Loop 특수 변수 (네임스페이스)
        context["loop"] = {
            "item": item,
            "index": index,
        }

        # 3. Loop 변수 직접 주입 (Dify 스타일 편의성)
        # 주의: 외부 변수와 이름 충돌 시 Loop 변수가 덮어쓸 수 있음을 유의
        context["item"] = item
        context["index"] = index

        return context

    def _map_inputs_hybrid(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        하이브리드 입력 매핑
        """
        if self.data.inputs:
            # 명시적 매핑
            mapped = {}
            for input_mapping in self.data.inputs:
                if input_mapping.value_selector:
                    value = self._resolve_variable(input_mapping.value_selector, inputs)
                else:
                    value = self._render_template(
                        input_mapping.name, inputs
                    )  # 템플릿 지원

                mapped[input_mapping.name] = value
            return mapped
        else:
            # 암시적: 모든 외부 변수 전달
            return inputs.copy()

    async def _execute_subgraph_scoped(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        서브그래프 실행 (스코프 기반)
        - 각 반복마다 독립된 WorkflowEngine 생성
        - context를 user_input으로 전달
        """
        subgraph_engine = self._create_subgraph_engine(context)
        return await subgraph_engine.execute()

    def _resolve_variable(
        self, value_selector: List[str], inputs: Dict[str, Any]
    ) -> Any:
        """
        [개선] 변수 참조 해결 (Strict Parsing)
        value_selector 예: ["node_id", "var_key", "nested", "0"]
        """
        if not value_selector or len(value_selector) == 0:
            return None

        # 1. 첫 번째 요소는 무조건 node_id 또는 특수 키(sys 등)로 간주
        node_id = value_selector[0]

        # inputs에서 찾기
        if node_id not in inputs:
            # 혹시 env 등 전역 변수일 수도 있음 (여기서는 미지원)
            return None

        current_value = inputs[node_id]

        # 2. 경로 추적
        path = value_selector[1:]
        for key in path:
            if isinstance(current_value, dict):
                current_value = current_value.get(key)
            elif isinstance(current_value, list):
                # 배열 인덱스 접근 지원
                if key.isdigit():
                    try:
                        idx = int(key)
                        if 0 <= idx < len(current_value):
                            current_value = current_value[idx]
                        else:
                            return None
                    except (ValueError, IndexError):
                        return None
                else:
                    return None
            else:
                return None

            if current_value is None:
                return None

        return current_value

    def _get_iteration_array(
        self, inputs: Dict[str, Any], mapped_inputs: Dict[str, Any]
    ) -> List[Any]:
        """
        반복 대상 배열 가져오기
        """
        import ast
        import json

        def try_parse_list(value: Any) -> Optional[List[Any]]:
            if isinstance(value, list):
                return value
            if isinstance(value, str):
                # 0. 공백 제거
                value = value.strip()
                # 1. JSON 시도
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return parsed
                except (json.JSONDecodeError, ValueError):
                    pass
                # 2. ast.literal_eval 시도 (Trailing comma 지원)
                try:
                    parsed = ast.literal_eval(value)
                    if isinstance(parsed, list):
                        return parsed
                except (ValueError, SyntaxError):
                    pass
            return None

        # 1. inputs에 loop_key가 있으면(매핑된 변수 등) 최우선
        if self.data.loop_key in mapped_inputs:
            val = mapped_inputs[self.data.loop_key]
            parsed = try_parse_list(val)
            if parsed is not None:
                return parsed

        # 2. value_selector 파싱 시도 (점 표기법)
        if "." in self.data.loop_key:
            parts = self.data.loop_key.split(".")
            val = self._resolve_variable(parts, inputs)
            parsed = try_parse_list(val)
            if parsed is not None:
                return parsed

        # 3. 템플릿 시도
        if "{{" in self.data.loop_key:
            context = self._build_variable_context(inputs)
            val = self._render_template(self.data.loop_key, context)
            parsed = try_parse_list(val)
            if parsed is not None:
                return parsed

        return []

    def _map_outputs_hybrid(
        self, results: List[Any], inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        [개선] 하이브리드 출력 매핑
        - outputs 설정이 있으면 해당 변수만 추출하여 배열로 반환
        - flatten_output 옵션 적용
        """
        # results에는 [run_result1, run_result2, ...] 형태가 됨. run_result는 Dict
        # 또는 에러 시 {"error": ...}

        valid_results = [r for r in results if r is not None and "error" not in r]

        if not self.data.outputs:
            # 매핑 없음 -> 전체 결과 반환
            if self.data.flatten_output:
                # 단순히 리스트의 리스트를 펼치는 것이 아니라, 전체 결과를 하나의 리스트로?
                # 보통 루프 노드의 '출력'이 없으면 각 반복의 최종 출력(마지막 노드?)들을 모을지 불분명.
                # 여기서는 원본 그대로 반환
                return {"results": results}
            else:
                return {"results": results}

        collected_outputs = {}

        for output_def in self.data.outputs:
            output_name = output_def.name
            value_selector = output_def.value_selector

            # value_selector가 유효하지 않으면 스킵
            if not value_selector:
                continue

            # 각 반복 결과에서 값 추출
            collected_values = []

            for run_result in valid_results:
                # run_result는 하나의 워크플로우 실행 결과 (Dict[node_id, output])
                # 여기서 value_selector를 적용해야 함.
                # 단, _resolve_variable은 inputs(Dict[node_id, output])을 받으므로 호환됨.
                val = self._resolve_variable(value_selector, run_result)
                if val is not None:
                    collected_values.append(val)

            # Flatten 처리
            if self.data.flatten_output:
                flattened = []
                for v in collected_values:
                    if isinstance(v, list):
                        flattened.extend(v)
                    else:
                        flattened.append(v)
                collected_outputs[output_name] = flattened
            else:
                collected_outputs[output_name] = collected_values

        return collected_outputs
