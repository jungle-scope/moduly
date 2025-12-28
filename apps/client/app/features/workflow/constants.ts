import { Node } from './types/Nodes';
import { StartNodeData } from './types/Nodes';

//TODO: 나중에 workflow DB가 확정되고 정리되어서 처음 생성한 workflow도 DB에서 값을 불러와 뿌려주게 되면 이 파일은 삭제
export const DEFAULT_NODES: Node[] = [
  {
    id: `start-${Date.now()}`,
    type: 'startNode',
    position: { x: 250, y: 250 },
    deletable: false, // 개발용으로 임시 삽입
    data: {
      title: '시작',
      triggerType: 'manual',
      variables: [],
    } as StartNodeData,
  },
];
