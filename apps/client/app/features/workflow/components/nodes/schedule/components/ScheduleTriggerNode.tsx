import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { ScheduleTriggerNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const ScheduleTriggerNode = memo(
  ({ data, selected, id }: NodeProps<Node<ScheduleTriggerNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        puzzleType="start"
        showTargetHandle={false} // ScheduleTrigger는 시작 노드이므로 입력 핸들 없음
        icon={<Clock className="text-white" />}
        iconColor="#8b5cf6" // violet-500
      >
        <div className="flex flex-col">
          <div className="text-xs text-gray-500 font-medium">
            {data.cron_expression}
          </div>
          <div className="text-xs text-gray-400">{data.timezone}</div>
        </div>
      </BaseNode>
    );
  },
);
ScheduleTriggerNode.displayName = 'ScheduleTriggerNode';
