import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';

import { BaseNode } from '../../BaseNode';
import { LLMNodeData } from '../../../../types/Nodes';

// NOTE: [LLM] LLM 노드 박스 UI (BaseNode를 사용해 일관된 껍데기 유지)
export const LLMNode = memo(
  ({ data, selected }: NodeProps<Node<LLMNodeData>>) => {
    return (
      <BaseNode data={data} selected={selected}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-gray-900 text-sm font-bold text-white">
            🤖
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500">Provider</div>
            <div className="text-sm font-semibold text-gray-900">
              {data.provider || '미지정'}
            </div>
            <div className="text-xs text-gray-500">Model</div>
            <div className="text-sm text-gray-800">
              {data.model_id || '모델을 선택하세요'}
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);
LLMNode.displayName = 'LLMNode';
