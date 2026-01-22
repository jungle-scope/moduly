import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';
import { ScheduleTriggerNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

import { formatCronExpression } from '../../../deployment/utils';

export const ScheduleTriggerNode = memo(
  ({ data, selected, id }: NodeProps<Node<ScheduleTriggerNodeData>>) => {
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        showTargetHandle={false} // ScheduleTrigger는 시작 노드이므로 입력 핸들 없음
        icon={<Clock className="text-white" />}
        iconColor="#8b5cf6" // violet-500
      >
        <div className="flex flex-col">
          <div className="text-xs text-gray-500 font-medium">
            {formatCronExpression(data.cron_expression)}
          </div>
        </div>
      </BaseNode>
    );
  },
);
ScheduleTriggerNode.displayName = 'ScheduleTriggerNode';
