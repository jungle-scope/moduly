import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';

import { BaseNode } from '../../BaseNode';
import { LLMNodeData } from '../../../../types/Nodes';

// NOTE: [LLM] LLM 노드 박스 UI (BaseNode를 사용해 일관된 껍데기 유지)
export const LLMNode = memo(
  ({ data, selected }: NodeProps<Node<LLMNodeData>>) => {
    return (
      <BaseNode
        data={data}
        selected={selected}
        icon={<Bot className="text-white" />}
        iconColor="#a855f7" // purple-500
      >
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Model</span>
            <span className="font-medium text-gray-900">
              {data.provider || '미지정'}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">
            {data.model_id || '모델을 선택하세요'}
          </div>
        </div>
      </BaseNode>
    );
  },
);
LLMNode.displayName = 'LLMNode';
