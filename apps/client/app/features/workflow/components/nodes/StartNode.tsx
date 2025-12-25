import { memo } from 'react';
import { NodeProps } from '@xyflow/react';

import { StartNodeData } from '../../types/Nodes';
import { BaseNode } from './BaseNode';

// [StartNode]
// BaseNode를 사용하여 '시작 노드'만의 내용을 채워넣습니다.
// memo를 사용하여 불필요한 리렌더링을 방지합니다.
export const StartNode = memo(
  ({ data, selected }: NodeProps<StartNodeData>) => {
    return (
      <BaseNode
        data={data}
        selected={selected}
        showTargetHandle={false} // 시작 노드는 들어오는 선이 없습니다.
        showSourceHandle={true}
        className="border-green-500/50" // 시작 노드임을 강조하는 약간의 스타일
      >
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            트리거 방식
          </label>
          <div className="rounded bg-muted p-2 text-xs">
            {data.triggerType || 'Manual'}
          </div>
        </div>
      </BaseNode>
    );
  },
);

StartNode.displayName = 'StartNode';
