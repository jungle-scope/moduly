import { memo } from 'react';
import { Handle, Position, Node, NodeProps } from '@xyflow/react';
import { StartNodeData } from '../../../../types/Nodes';

export const StartNode = memo(
  ({ data, selected }: NodeProps<Node<StartNodeData>>) => {
    return (
      <div
        className={`
          relative bg-white rounded-lg border-2 px-4 py-3 shadow-md transition-all cursor-pointer
          min-w-[200px]
          ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
          
          {/* 실행 상태 시각화 (BaseNode와 동일한 로직 적용) */}
          ${data.status === 'running' && 'border-blue-500 ring-2 ring-blue-500/20 animate-pulse'}
          ${data.status === 'success' && 'border-green-500 ring-2 ring-green-500/20'}
          ${data.status === 'failure' && 'border-red-500 ring-2 ring-red-500/20'}
        `}
      >
        {/* Source Handle (Right side) */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white"
        />

        {/* Node Content */}
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded text-white font-bold text-sm">
            ▶️
          </div>

          {/* Text Content */}
          <div className="flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              {data.title || 'Start'}
            </div>
            <div className="text-xs text-gray-500">Input</div>
          </div>
        </div>
      </div>
    );
  },
);
StartNode.displayName = 'StartNode';
