import { memo } from 'react';

import { WorkflowNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

interface WorkflowNodeProps {
  data: WorkflowNodeData;
  selected?: boolean;
}

// **워크플로우 모듈 노드 컴포넌트**
// 다른 워크플로우(App)를 하나의 노드처럼 가져와서 실행할 수 있게 해줍니다.
// 가져온 앱의 아이콘과 이름을 표시합니다.
export const WorkflowNode = memo(({ data, selected }: WorkflowNodeProps) => {
  // BaseNode 헤더에 설명이 중복 표시되지 않도록 description을 제외하고 전달
  const baseNodeData = { ...data, description: undefined };

  return (
    <BaseNode
      data={baseNodeData}
      selected={selected}
      className="border-purple-500 bg-purple-50/50 dark:bg-purple-900/10"
    >
      <div className="flex items-center gap-3 py-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
          {data.icon ? (
            <span className="text-xl">{data.icon}</span>
          ) : (
            <div className="h-full w-full rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600" />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground mt-1">
            {data.description || '설명 없음'}
          </span>
        </div>
      </div>
    </BaseNode>
  );
});

WorkflowNode.displayName = 'WorkflowNode';
