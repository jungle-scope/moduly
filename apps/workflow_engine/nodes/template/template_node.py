from typing import Any, Dict, List

from jinja2 import Template

from apps.workflow_engine.nodes.base.node import Node

from .entities import TemplateNodeData


def _get_nested_value(data: Any, keys: List[str]) -> Any:
    """
    중첩된 딕셔너리에서 키 경로를 따라 값을 추출합니다.
    """
    for key in keys:
        if isinstance(data, dict):
            data = data.get(key)
        else:
            return None
    return data


class TemplateNode(Node[TemplateNodeData]):
    """
    여러 변수를 조합하여 텍스트를 생성하는 노드입니다.
    Jinja2 템플릿 엔진을 사용합니다.
    """

    node_type = "templateNode"

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        1. 설정된 변수들의 값을 inputs에서 가져와 context를 구성합니다.
        2. Jinja2 템플릿을 렌더링합니다.
        3. 결과를 반환합니다.
        """
        context = {}

        # 1. Context 구성
        for variable in self.data.variables:
            var_name = variable.name
            selector = variable.value_selector

            # 필수값 체크
            if not var_name or not selector or len(selector) < 1:
                context[var_name] = ""  # 값이 없으면 빈 문자열 처리
                continue

            target_node_id = selector[0]

            # 입력 데이터에서 해당 노드의 결과 찾기
            source_data = inputs.get(target_node_id)

            if source_data is None:
                context[var_name] = ""
                continue

            # 값 추출 (selector가 2개 이상일 경우 중첩된 값 탐색)
            # 예: ["NodeA", "outputKey"] -> inputs["NodeA"]["outputKey"]
            if len(selector) > 1:
                value = _get_nested_value(source_data, selector[1:])
                context[var_name] = value if value is not None else ""
            else:
                # selector가 노드 ID만 있는 경우 (드물지만 처리)
                context[var_name] = source_data

        # 2. 렌더링
        try:
            template = Template(self.data.template)
            rendered_text = template.render(context)
        except Exception as e:
            print(f"[{self.data.title}] 템플릿 렌더링 오류: {e}")
            rendered_text = f"(Error: {str(e)})"

        print(f"[{self.data.title}] 렌더링 완료: {rendered_text[:50]}...")

        return {"text": rendered_text}
