import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { BookOpen } from 'lucide-react';
import { VariableExtractionNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const VariableExtractionNode = memo(
  ({ data, selected, id }: NodeProps<Node<VariableExtractionNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        icon={<BookOpen className="text-white" />}
        iconColor="#0891b2"
      />
    );
  },
);

VariableExtractionNode.displayName = 'VariableExtractionNode';
