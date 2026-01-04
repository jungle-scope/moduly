import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { StartNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const StartNode = memo(
  ({ data, selected, id }: NodeProps<Node<StartNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        puzzleType="start"
        showTargetHandle={false} // StartNode has no input
        icon={<Play className="text-white fill-current" />}
        iconColor="#3b82f6" // blue-500
      />
    );
  },
);
StartNode.displayName = 'StartNode';
