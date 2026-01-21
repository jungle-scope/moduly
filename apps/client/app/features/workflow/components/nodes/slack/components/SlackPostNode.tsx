import { memo, useMemo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Slack } from 'lucide-react';

import { SlackPostNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { ValidationBadge } from '../../../ui/ValidationBadge';
import { hasIncompleteVariables } from '../../../../utils/validationUtils';

export const SlackPostNode = memo(
  ({ data, selected }: NodeProps<Node<SlackPostNodeData>>) => {
    const mode = data.slackMode || 'api';
    const urlPreview = data.url || 'https://hooks.slack.com/services/...';
    const modeClass =
      mode === 'api'
        ? 'bg-blue-100 text-blue-700 border-blue-200'
        : 'bg-purple-100 text-purple-700 border-purple-200';
    const modeLabel = mode === 'api' ? 'API' : 'Web Hook';
    const trimmedUrl = (data.url || '').trim();
    const blocksText = (data.blocks || '').trim();

    const missingVariables = useMemo(() => {
      const regex = /{{\s*([^}]+?)\s*}}/g;
      const combined = (data.message || '') + (data.blocks || '');
      const registered = new Set(
        (data.referenced_variables || [])
          .map((v) => v.name?.trim())
          .filter(Boolean),
      );
      const missing = new Set<string>();
      let match;
      while ((match = regex.exec(combined)) !== null) {
        const varName = match[1].trim();
        if (varName && !registered.has(varName)) {
          missing.add(varName);
        }
      }
      return Array.from(missing);
    }, [data.message, data.blocks, data.referenced_variables]);

    const blocksJsonError = useMemo(() => {
      if (!blocksText) return false;
      try {
        JSON.parse(blocksText);
        return false;
      } catch {
        return true;
      }
    }, [blocksText]);

    const isWebhookUrlValid =
      mode !== 'webhook'
        ? true
        : trimmedUrl.startsWith('https://hooks.slack.com/') &&
          trimmedUrl.includes('/services/');

    const hasValidationIssue = useMemo(() => {
      const hasMessage = !!data.message?.trim();
      const hasValidBlocks = !!blocksText && !blocksJsonError;

      if (mode === 'webhook') {
        if (!trimmedUrl || !isWebhookUrlValid) return true;
      } else {
        if (!trimmedUrl) return true;
        if (!data.authConfig?.token?.trim()) return true;
        if (!data.channel?.trim()) return true;
      }

      if (!hasMessage && !hasValidBlocks) return true;
      if (blocksJsonError) return true;
      if (missingVariables.length > 0) return true;
      if (hasIncompleteVariables(data.referenced_variables)) return true;

      return false;
    }, [
      mode,
      trimmedUrl,
      isWebhookUrlValid,
      data.message,
      data.authConfig?.token,
      data.channel,
      blocksText,
      blocksJsonError,
      missingVariables.length,
    ]);

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
            <span className="flex-1 truncate font-mono text-[10px] text-gray-500 max-w-[200px]">
              {urlPreview}
            </span>
          </div>

          {hasValidationIssue && <ValidationBadge />}
        </div>
      </BaseNode>
    );
  },
);

SlackPostNode.displayName = 'SlackPostNode';
