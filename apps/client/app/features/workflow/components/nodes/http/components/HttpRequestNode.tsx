import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Globe } from 'lucide-react';
import { HttpRequestNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

// Method badge colors
const methodColors: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700 border-blue-200',
  POST: 'bg-green-100 text-green-700 border-green-200',
  PUT: 'bg-orange-100 text-orange-700 border-orange-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  PATCH: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const defaultMethodColor = 'bg-gray-100 text-gray-700 border-gray-200';

export const HttpRequestNode = memo(
  ({ data, selected }: NodeProps<Node<HttpRequestNodeData>>) => {
    const method = data.method || 'GET';
    const methodClass = methodColors[method] || defaultMethodColor;

    return (
      <BaseNode
        data={data}
        selected={selected}
        showSourceHandle={true}
        icon={<Globe className="text-white" />}
        iconColor="#0ea5e9" // sky-500
      >
        <div className="flex flex-col gap-2 p-1 max-w-[240px]">
          {/* Method and URL Preview */}
          <div className="flex items-center gap-2">
            <div
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${methodClass}`}
            >
              {method}
            </div>
            <div
              className="text-xs text-gray-600 flex-1 truncate font-mono"
              title={data.url || 'URL을 입력하세요'}
            >
              {data.url || 'URL을 입력하세요'}
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

HttpRequestNode.displayName = 'HttpRequestNode';
