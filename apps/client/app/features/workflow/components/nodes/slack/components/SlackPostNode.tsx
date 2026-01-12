import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Slack } from 'lucide-react';

import { SlackPostNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const SlackPostNode = memo(
  ({ data, selected }: NodeProps<Node<SlackPostNodeData>>) => {
    const mode = data.slackMode || 'webhook';
    const messagePreview = data.message?.trim() || '';
    const urlPreview =
      data.url || 'https://hooks.slack.com/services/...';
    const modeClass =
      mode === 'api'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-purple-100 text-purple-700 border-purple-200';
    const modeLabel = mode === 'api' ? 'API' : 'Web Hook';

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
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${modeClass}`}
            >
              {modeLabel}
            </span>
            <span className="flex-1 truncate font-mono text-[10px] text-gray-500">
              {urlPreview}
            </span>
          </div>

          {messagePreview && (
            <div className="rounded border border-gray-100 bg-gradient-to-br from-white to-purple-50/60 p-2 shadow-inner">
              <div className="text-[11px] text-gray-600 line-clamp-2 whitespace-pre-wrap">
                {messagePreview}
              </div>
            </div>
          )}
        </div>
      </BaseNode>
    );
  },
);

SlackPostNode.displayName = 'SlackPostNode';
