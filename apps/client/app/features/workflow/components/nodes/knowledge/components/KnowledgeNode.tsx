import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { BookOpen } from 'lucide-react';

import { BaseNode } from '../../BaseNode';
import { KnowledgeNodeData } from '../../../../types/Nodes';

export const KnowledgeNode = memo(
  ({ data, selected }: NodeProps<Node<KnowledgeNodeData>>) => {
    const knowledgeBases = data.knowledgeBases || [];
    const primaryName = knowledgeBases[0]?.name || '지식 베이스 미선택';
    const extraCount = Math.max(knowledgeBases.length - 1, 0);

    return (
      <BaseNode
        data={data}
        selected={selected}
        icon={<BookOpen className="text-white" />}
        iconColor="#6366f1"
      >
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-500 font-medium">
            Knowledge Base
          </div>
          <div className="text-sm font-semibold text-gray-900 truncate">
            {primaryName}
          </div>
          {extraCount > 0 && (
            <div className="text-[11px] text-gray-500">
              외 {extraCount}개 선택됨
            </div>
          )}
        </div>
      </BaseNode>
    );
  },
);

KnowledgeNode.displayName = 'KnowledgeNode';
