import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, Generic, TypeVar, final

from .entities import BaseNodeData, NodeStatus

logger = logging.getLogger(__name__)

# NodeDataT는 BaseNodeData를 상속받는 어떤 클래스든 될 수 있다는 뜻입니다.
NodeDataT = TypeVar("NodeDataT", bound=BaseNodeData)


class Node(ABC, Generic[NodeDataT]):
    """
    모든 노드의  Base Class입니다.
    복잡한 이벤트 처리는 다 걷어내고, '입력을 받아 결과를 내는' 행위에만 집중합니다.
    """

    # 자식 클래스에서 정의해야 할 타입 이름 (예: "start", "llm")
    node_type: str

    def __init__(
        self, id: str, data: NodeDataT, execution_context: Dict[str, Any] = None
    ):
        self.id = id
        self.data = data
        self.execution_context = execution_context or {}
        self.status = NodeStatus.IDLE

    @final
    async def execute(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        [Template Method Pattern]
        실제 실행 흐름을 제어합니다. (로그 남기기, 상태 변경 등)
        하위 클래스는 이 메서드를 override 하지 말고, _run()만 구현하면 됩니다.
        """
        logger.info(f"[{self.node_type}] 노드 실행 시작: {self.data.title}")
        self.status = NodeStatus.RUNNING

        try:
            # 실제 비즈니스 로직 실행 (하위 클래스에 위임)
            outputs = await self._run(inputs)

            self.status = NodeStatus.COMPLETED
            logger.info(f"[{self.node_type}] 실행 성공!")
            return outputs

        except Exception as e:
            self.status = NodeStatus.FAILED
            logger.info(f"[{self.node_type}] 실행 실패: {str(e)}")
            raise e

    @abstractmethod
    async def _run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        [Abstract Method]
        각 노드가 실제로 수행해야 할 로직을 여기에 구현합니다.

        Args:
            inputs: 이전 노드들로부터 전달받은 데이터 모음
        Returns:
            다음 노드로 전달할 결과 데이터
        """
        pass
