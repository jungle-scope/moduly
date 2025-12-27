import { memo } from 'react';
import { Handle, Position, Node, NodeProps } from '@xyflow/react';
import { LLMNodeData } from '../../../../types/Nodes';

// NOTE: [LLM] LLM 노드 박스 UI
export const LLMNode = memo(
  ({ data, selected }: NodeProps<Node<LLMNodeData>>) => {
    return (
      <div
        className={`
          relative bg-white rounded-lg border-2 px-4 py-3 shadow-md transition-all cursor-pointer
          min-w-[220px]
          ${selected ? 'border-gray-900 ring-2 ring-gray-900/15' : 'border-gray-300'}
        `}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-gray-900 !w-3 !h-3"
        />

        <Handle
          type="source"
          position={Position.Right}
          className="!bg-gray-900 !w-3 !h-3"
        />

        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-900 rounded text-white font-bold text-sm">
            🤖
          </div>
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              {data.title || 'LLM'}
            </div>
            <div className="text-xs text-gray-500">
              {data.model_id || 'Select model'}
            </div>
          </div>
        </div>
      </div>
    );
  },
);
LLMNode.displayName = 'LLMNode';
