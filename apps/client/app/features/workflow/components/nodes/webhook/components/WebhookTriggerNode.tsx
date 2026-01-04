import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { WebhookTriggerNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const WebhookTriggerNode = memo(
  ({ data, selected }: NodeProps<Node<WebhookTriggerNodeData>>) => {
    return (
      <BaseNode data={data} selected={selected}>
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className="flex items-center justify-center w-8 h-8 bg-purple-500 rounded text-white font-bold text-sm">
            🔗
          </div>

          {/* Text Content */}
          <div className="flex flex-col">
            <div className="text-xs text-gray-500">
              {data.provider === 'jira' ? 'Jira' : 'Custom'}
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);
WebhookTriggerNode.displayName = 'WebhookTriggerNode';
