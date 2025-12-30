import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Code } from 'lucide-react';
import { CodeNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const CodeNode = memo(
  ({ data, selected }: NodeProps<Node<CodeNodeData>>) => {
    return (
      <BaseNode
        data={data}
        selected={selected}
        className="border-green-500 hover:border-green-600 ring-green-500"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded">
            <Code className="w-4 h-4 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500">
              {data.inputs?.length || 0}개 입력 변수
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

CodeNode.displayName = 'CodeNode';
