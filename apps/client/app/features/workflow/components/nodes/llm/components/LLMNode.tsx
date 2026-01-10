import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';

import { BaseNode } from '../../BaseNode';
import { LLMNodeData } from '../../../../types/Nodes';

// NOTE: [LLM] LLM 노드 박스 UI (BaseNode를 사용해 일관된 껍데기 유지)
export const LLMNode = memo(
  ({ data, selected, id }: NodeProps<Node<LLMNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        icon={<Bot className="text-white" />}
        iconColor="#a855f7" // purple-500
      >
        <div className="flex flex-col gap-1">
          <div className="text-sm font-semibold text-gray-800 truncate">
            {data.model_id || '모델 미지정'}
          </div>
        </div>
      </BaseNode>
    );
  },
);
LLMNode.displayName = 'LLMNode';
