import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Code } from 'lucide-react';
import { CodeNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const CodeNode = memo(
  ({ data, selected, id }: NodeProps<Node<CodeNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        icon={<Code className="text-white" />}
        iconColor="#3b82f6" // blue-500
      >
        <div className="text-xs text-gray-500">
          {data.inputs?.length || 0}개 입력변수
        </div>
      </BaseNode>
    );
  },
);

CodeNode.displayName = 'CodeNode';
