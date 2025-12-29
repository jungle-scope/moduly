import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Code } from 'lucide-react';
import { CodeNodeData } from '../../../../types/Nodes';

interface CodeNodeProps {
  data: CodeNodeData;
  selected: boolean;
}

export function CodeNode({ data, selected }: CodeNodeProps) {
  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 bg-white shadow-md
        min-w-[200px] transition-all duration-200
        ${selected ? 'border-blue-500 shadow-lg' : 'border-gray-300'}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      {/* Node Content */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-green-100 rounded">
          <Code className="w-4 h-4 text-green-600" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm text-gray-900">
            {data.title || 'Code'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {data.inputs?.length || 0}개 입력 변수
          </div>
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
}
