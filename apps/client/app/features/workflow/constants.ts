import { Node } from './types/Nodes';
import { StartNodeData } from './types/Nodes';

// 나중에 workflow DB가 확정되고 정리되어서 처음 생성한 workflow도 DB에서 값을 불러와 뿌려주게 되면 이 파일은 삭제
// 새로운 워크플로우를 생성할 때 기본 시작 노드(default Node)를 제공하는 파일입니다.

export const DEFAULT_NODES: Node[] = [
  {
    id: `start-${Date.now()}`,
    type: 'startNode',
    position: { x: 250, y: 250 },
    data: {
      title: '입력',
      triggerType: 'manual',
      variables: [],
    } as StartNodeData,
  },
];
