import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Webhook } from 'lucide-react';
import { WebhookTriggerNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const WebhookTriggerNode = memo(
  ({ data, selected }: NodeProps<Node<WebhookTriggerNodeData>>) => {
    return (
      <BaseNode
        data={data}
        selected={selected}
        icon={<Webhook className="text-white" />}
        iconColor="#a855f7"
      >
        <div className="flex flex-col">
          {/* <div className="text-xs text-gray-500 font-medium">
            {data.provider === 'jira' ? 'Jira' : 'Custom'} Webhook
          </div> */}
        </div>
      </BaseNode>
    );
  },
);
WebhookTriggerNode.displayName = 'WebhookTriggerNode';
