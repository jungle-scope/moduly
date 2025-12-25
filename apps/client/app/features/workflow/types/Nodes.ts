import { Node as ReactFlowNode } from '@xyflow/react';

// 1. 공통 데이터 (부모)
// 모든 노드가 가져야 할 공통 필드를 정의합니다.
export interface BaseNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  selected?: boolean;
}

// 2. 개별 노드 데이터 (자식)
// 종료 노드 데이터
export interface EndNodeData extends BaseNodeData {
  outputType: 'json' | 'text';
}

// 3. 노드 타입 정의
export type EndNode = ReactFlowNode<EndNodeData, 'endNode'>;

// 4. 전체 노드 유니온
export type AppNode = EndNode;

// 하위 호환성을 위해 기존 이름 유지 (필요한 경우)
export type NodeData = BaseNodeData;
export type Node = AppNode;
