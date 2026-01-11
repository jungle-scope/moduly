"""코드 실행 노드 - Docker 샌드박스에서 Python 코드를 안전하게 실행"""

from typing import Any, Dict

from services.docker_service import DockerSandboxService
from workflow.nodes.base.node import Node
from workflow.nodes.code.entities import CodeNodeData


class CodeNode(Node[CodeNodeData]):
    """
    코드 실행 노드 - Docker에서 사용자가 제공한 Python 코드를 안전하게 실행

    보안 기능:
    - 격리된 Docker 컨테이너
    - 비root 사용자 실행
    - 네트워크 비활성화
    - 리소스 제한 (CPU, Memory, Swap, PIDs)
    - 임시 파일용 tmpfs
    - 타임아웃 보호
    """

    node_type = "codeNode"

    def __init__(
        self, id: str, data: CodeNodeData, execution_context: Dict[str, Any] = None
    ):
        super().__init__(id, data, execution_context)
        self.docker_service = DockerSandboxService()

    def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Docker 샌드박스에서 Python 코드 실행

        Args:
            inputs: 이전 노드들의 컨텍스트 (예: {"Start": {"query": "hello"}})

        Returns:
            사용자 코드의 결과 딕셔너리 또는 에러 딕셔너리
        """
        # 1. 변수 치환: UI에서 정의한 입력 변수 매핑
        code_inputs = {}
        for inp in self.data.inputs:
            # "Start.query" -> inputs["Start"]["query"]
            try:
                node_id, var_name = inp.source.split(".", 1)
                if node_id in inputs and var_name in inputs[node_id]:
                    code_inputs[inp.name] = inputs[node_id][var_name]
                else:
                    # 변수를 찾지 못한 경우 에러 반환
                    return {
                        "error": f"Variable not found: {inp.source} (referenced as '{inp.name}')"
                    }
            except ValueError:
                return {"error": f"Invalid variable source format: {inp.source}"}

        # 2. Docker에서 코드 실행
        result = self.docker_service.execute_python_code(
            code=self.data.code, inputs=code_inputs, timeout=self.data.timeout
        )

        return result
