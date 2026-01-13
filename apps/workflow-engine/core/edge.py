# TODO: edge class 사용해서 조건부 분기 구현하기
# 아직은 사용되지 않지만, 조건부 분기를 구현하기 위해서 edge class가 필요해서 일단 만들어두었습니다.
# if-else 분기에서 실행되지 않는 노드 + 엣지들은 SKIPPED 상태로 마킹하는 로직이 필요합니다.


from .entities import EdgeStatus


class Edge:
    """
    워크플로우의 엣지(연결선)를 나타내는 클래스
    노드 간의 연결과 실행 상태를 관리합니다.
    """

    def __init__(self, id: str, source: str, target: str):
        """
        Args:
            id: 엣지 고유 ID
            source: 시작 노드 ID
            target: 목표 노드 ID
        """
        self.id = id
        self.source = source
        self.target = target
        self.status = EdgeStatus.IDLE

    def mark_executed(self):
        """엣지를 실행됨 상태로 변경"""
        self.status = EdgeStatus.EXECUTED

    def mark_skipped(self):
        """엣지를 스킵됨 상태로 변경"""
        self.status = EdgeStatus.SKIPPED

    def is_executed(self) -> bool:
        """엣지가 실행되었는지 확인"""
        return self.status == EdgeStatus.EXECUTED

    def __repr__(self):
        return f"Edge(id={self.id}, {self.source} → {self.target}, status={self.status.value})"
