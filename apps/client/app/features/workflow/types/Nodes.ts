import { Node as ReactFlowNode } from '@xyflow/react';

// 1. 공통 데이터 (부모)
// 서버의 BaseNodeData에 대응됩니다.
// 모든 노드가 가져야 할 공통 필드를 정의합니다.
export interface BaseNodeData extends Record<string, unknown> {
  // 서버와 필드명을 맞춥니다.
  title: string; // label -> title
  description?: string;

  // ReactFlow에서 사용하는 UI 상태값
  selected?: boolean;
}

// 2. 개별 노드 데이터 (자식)

// [StartNode]
export interface StartNodeData extends BaseNodeData {
  triggerType: string; // 'manual', 'webhook' 등
}

// [EndNode]
export interface EndNodeData extends BaseNodeData {
  outputType: 'json' | 'text';
}

// 3. 노드 타입 정의 (ReactFlow Node 제네릭 사용)
export type StartNode = ReactFlowNode<StartNodeData, 'start'>; // type: 'start'
export type EndNode = ReactFlowNode<EndNodeData, 'end'>; // type: 'end'

// 4. 전체 노드 유니온 (AppNode)
// 이 타입을 메인 워크플로우에서 사용합니다.
export type AppNode = StartNode | EndNode;

// 하위 호환성 (필요시)
export type NodeData = BaseNodeData;
export type Node = AppNode;
