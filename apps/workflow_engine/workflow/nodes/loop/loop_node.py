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
        self._subgraph_engine = None  # 재사용할 엔진

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

    def _build_variable_context(
        self, inputs: Dict[str, Any], item: Any = None, index: int = None
    ) -> Dict[str, Any]:
        """
        모든 외부 노드 출력 + Loop 변수를 포함한 컨텍스트 생성
        모든 변수가 자동으로 접근 가능
        """
        context = {}

        # 외부 노드 출력 모두 포함
        for node_id, node_output in inputs.items():
            context[node_id] = node_output

        # Loop 특수 변수
        context["loop"] = {
            "item": item,
            "index": index,
        }

        return context

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Loop Node 실행 로직 (하이브리드 방식)
        """
        import asyncio

        # 1. 서브그래프 검증
        if not self.data.subGraph or not self.data.subGraph.get("nodes"):
            return {"error": "No subgraph defined", "results": []}

        # 2. 하이브리드 입력 매핑
        mapped_inputs = self._map_inputs_hybrid(inputs)

        # 3. 반복 대상 배열 가져오기
        array_to_iterate = self._get_iteration_array(inputs, mapped_inputs)

        if not isinstance(array_to_iterate, list):
            return {"error": "Loop target is not an array", "results": []}

        # 4. 반복 실행
        results = []
        iteration_count = 0
        max_iterations = self.data.max_iterations or 100

        for item in array_to_iterate:
            if iteration_count >= max_iterations:
                break

            try:
                # 변수 컨텍스트 구축 (모든 외부 변수 + loop 변수)
                context = self._build_variable_context(
                    inputs, item=item, index=iteration_count
                )

                # 서브그래프 실행 (스코프 기반)
                result = asyncio.run(self._execute_subgraph_scoped(context))
                results.append(result)

            except Exception as e:
                # 오류 처리 전략 적용
                if self.data.error_strategy == "end":
                    raise
                elif self.data.error_strategy == "continue":
                    results.append({"error": str(e)})

            iteration_count += 1

        # 5. 출력 변수 매핑 및 결과 반환
        return self._map_outputs_hybrid(results, inputs)

    def _map_inputs_hybrid(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        하이브리드 입력 매핑:
        1. inputs 배열이 있으면 명시적 매핑 사용
        2. 없으면 모든 외부 변수 자동 전달
        """
        if self.data.inputs:
            # 명시적 매핑
            mapped = {}
            for input_mapping in self.data.inputs:
                # 템플릿 문법 지원
                if input_mapping.value_selector:
                    value = self._resolve_variable(input_mapping.value_selector, inputs)
                else:
                    # value_selector가 없으면 name을 템플릿으로 처리
                    value = self._render_template(input_mapping.name, inputs)

                mapped[input_mapping.name] = value
            return mapped
        else:
            # 암시적: 모든 외부 변수 전달
            return inputs.copy()

    async def _execute_subgraph_scoped(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        스코프 기반 서브그래프 실행
        매번 새 엔진을 생성하지 않고 변수 컨텍스트만 변경
        """
        from workflow.core.workflow_engine import WorkflowEngine

        # 첫 실행 시에만 엔진 생성
        if self._subgraph_engine is None:
            self._subgraph_engine = WorkflowEngine(
                graph={
                    "nodes": self.data.subGraph["nodes"],
                    "edges": self.data.subGraph.get("edges", []),
                },
                user_input=context,
                execution_context=self.execution_context.copy(),
                is_deployed=False,
                db=self.execution_context.get("db"),
                workflow_timeout=300,
            )

        # 컨텍스트 업데이트 (스코프 변경)
        self._subgraph_engine.user_input = context

        # 실행
        result = await self._subgraph_engine.execute()
        return result

    def _resolve_variable(
        self, value_selector: List[str], inputs: Dict[str, Any]
    ) -> Any:
        """
        변수 참조 해결
        value_selector: [node_id, variable_key] 또는 [node_id, variable_key, nested_key, ...]
        """
        if not value_selector or len(value_selector) < 2:
            return None

        node_id = value_selector[0]
        variable_path = value_selector[1:]

        # inputs에서 노드 출력 찾기
        if node_id not in inputs:
            return None

        node_output = inputs[node_id]

        # 중첩된 경로 탐색
        current_value = node_output
        for key in variable_path:
            if isinstance(current_value, dict):
                current_value = current_value.get(key)
            elif isinstance(current_value, list) and key.isdigit():
                try:
                    current_value = current_value[int(key)]
                except (IndexError, ValueError):
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
        반복 대상 배열 가져오기 (템플릿 지원)
        """
        if not self.data.loop_key:
            # loop_key가 없으면 mapped_inputs에서 첫 번째 배열 찾기
            for value in mapped_inputs.values():
                if isinstance(value, list):
                    return value
            return []

        # 템플릿 문법 지원
        if "{{" in self.data.loop_key:
            context = self._build_variable_context(inputs)
            array = self._render_template(self.data.loop_key, context)
            if isinstance(array, list):
                return array
            return []

        # value_selector 형식으로 파싱
        parts = self.data.loop_key.split(".")

        if len(parts) >= 2:
            value_selector = parts
            array = self._resolve_variable(value_selector, inputs)

            if isinstance(array, list):
                return array

        # 폴백: mapped_inputs에서 loop_key로 직접 찾기
        if self.data.loop_key in mapped_inputs:
            value = mapped_inputs[self.data.loop_key]
            if isinstance(value, list):
                return value

        return []

    def _map_outputs_hybrid(
        self, results: List[Dict], inputs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        하이브리드 출력 매핑:
        1. outputs 배열이 있으면 명시적 수집
        2. 없으면 전체 결과 반환
        """
        if not self.data.outputs:
            # outputs가 정의되지 않은 경우, 전체 결과 반환
            if self.data.flatten_output:
                flattened = []
                for result in results:
                    if isinstance(result, list):
                        flattened.extend(result)
                    else:
                        flattened.append(result)
                return {"results": flattened}
            else:
                return {"results": results}

        # outputs에 정의된 변수만 추출
        collected_outputs = {}

        for output_def in self.data.outputs:
            output_name = output_def.name
            value_selector = output_def.value_selector

            if not value_selector or len(value_selector) < 2:
                continue

            # 각 반복 결과에서 해당 변수 수집
            collected_values = []
            for result in results:
                node_id = value_selector[0]
                variable_path = value_selector[1:]

                # result에서 노드 출력 찾기
                if node_id in result:
                    value = result[node_id]

                    # 중첩된 경로 탐색
                    for key in variable_path:
                        if isinstance(value, dict):
                            value = value.get(key)
                        elif isinstance(value, list) and key.isdigit():
                            try:
                                value = value[int(key)]
                            except (IndexError, ValueError):
                                value = None
                                break
                        else:
                            value = None
                            break

                    if value is not None:
                        collected_values.append(value)

            # flatten_output 적용
            if self.data.flatten_output and collected_values:
                flattened = []
                for val in collected_values:
                    if isinstance(val, list):
                        flattened.extend(val)
                    else:
                        flattened.append(val)
                collected_outputs[output_name] = flattened
            else:
                collected_outputs[output_name] = collected_values

        return collected_outputs if collected_outputs else {"results": results}
