import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface CustomNodeData {
  label: string;
  config?: Record<string, unknown>;
  input?: string;
  output?: string;
}

const CustomNode = ({ data, selected }: NodeProps<CustomNodeData>) => {
  return (
    <div
      className={`
        bg-white rounded-lg border-2 min-w-[200px] shadow-md
        ${selected ? 'border-blue-500' : 'border-gray-200'}
        transition-all hover:shadow-lg
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <span className="font-semibold text-gray-800">{data.label}</span>
        </div>

        {data.input && (
          <div className="text-xs text-gray-500 mb-1">
            <span className="font-medium">Input:</span> {data.input}
          </div>
        )}

        {data.output && (
          <div className="text-xs text-gray-500">
            <span className="font-medium">Output:</span> {data.output}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400 border-2 border-white"
      />
    </div>
  );
};

export default memo(CustomNode);
