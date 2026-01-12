import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Mail } from 'lucide-react';
import { MailNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

const providerColors: Record<string, string> = {
  gmail: '#EA4335',
  naver: '#EA4335',
  daum: '#EA4335',
  outlook: '#EA4335',
  custom: '#EA4335',
};

const providerNames: Record<string, string> = {
  gmail: 'Gmail',
  naver: 'Naver',
  daum: 'Daum',
  outlook: 'Outlook',
  custom: '직접 설정',
};

export const MailNode = memo(
  ({ data, selected }: NodeProps<Node<MailNodeData>>) => {
    const provider = data.provider || 'gmail';
    const iconColor = providerColors[provider] || providerColors.custom;
    const providerName = providerNames[provider] || provider;

    return (
      <BaseNode
        data={data}
        selected={selected}
        showSourceHandle={true}
        icon={<Mail className="text-white" />}
        iconColor={iconColor}
      >
        <div className="flex flex-col gap-1 p-1">
          {/* Provider Badge */}
          <div className="flex items-center gap-2">
            <div className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
              {providerName}
            </div>
            {data.email && (
              <div className="text-xs text-gray-600 flex-1 truncate">
                {data.email}
              </div>
            )}
          </div>

          {/* Search Info */}
          {data.keyword && (
            <div className="text-xs text-gray-600 truncate">
              <span className="font-medium">키워드:</span> {data.keyword}
            </div>
          )}
          {data.sender && (
            <div className="text-xs text-gray-600 truncate">
              <span className="font-medium">보낸 사람:</span> {data.sender}
            </div>
          )}
        </div>
      </BaseNode>
    );
  },
);

MailNode.displayName = 'MailNode';
