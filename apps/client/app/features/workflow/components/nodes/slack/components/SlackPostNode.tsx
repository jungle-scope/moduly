import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Slack } from 'lucide-react';

import { SlackPostNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const SlackPostNode = memo(
  ({ data, selected }: NodeProps<Node<SlackPostNodeData>>) => {
    const mode = data.slackMode || 'webhook';
    const messagePreview =
      data.message?.trim() || 'Slack 메시지를 작성하세요.';
    const urlPreview =
      data.url || 'https://hooks.slack.com/services/...';

    return (
      <BaseNode
        data={data}
        selected={selected}
        showSourceHandle={true}
        icon={<Slack className="text-white" />}
        iconColor="#4A154B"
      >
        <div className="flex flex-col gap-2 p-1">
          <div className="flex items-center gap-2 text-[11px] text-gray-600">
            <span className="px-2 py-0.5 rounded-full bg-[#4A154B]/10 text-[#4A154B] font-semibold uppercase tracking-wide">
              {mode === 'api' ? 'API' : 'Webhook'}
            </span>
            <span className="flex-1 truncate font-mono text-[10px] text-gray-500">
              {urlPreview}
            </span>
          </div>

          <div className="rounded border border-gray-100 bg-gradient-to-br from-white to-purple-50/60 p-2 shadow-inner">
            <div className="text-[11px] text-gray-600 line-clamp-2 whitespace-pre-wrap">
              {messagePreview}
            </div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

SlackPostNode.displayName = 'SlackPostNode';
