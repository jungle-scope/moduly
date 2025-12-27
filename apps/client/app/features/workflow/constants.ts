import { Node } from '@xyflow/react';
import { StartNodeData } from './types/Nodes';

export const DEFAULT_NODES: Node[] = [
  {
    id: 'start-1',
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
