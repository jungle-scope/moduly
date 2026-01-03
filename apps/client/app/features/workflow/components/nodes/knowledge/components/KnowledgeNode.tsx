import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { BookOpen } from 'lucide-react';

import { BaseNode } from '../../BaseNode';
import { KnowledgeNodeData } from '../../../../types/Nodes';

export const KnowledgeNode = memo(
  ({ data, selected }: NodeProps<Node<KnowledgeNodeData>>) => {
    const knowledgeBaseName = data.knowledgeBaseName || '지식 베이스 미선택';
    const topK = data.topK ?? 3;

    return (
      <BaseNode data={data} selected={selected}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-indigo-600 text-sm font-bold text-white">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500">Knowledge Base</div>
            <div className="text-sm font-semibold text-gray-900 truncate">
              {knowledgeBaseName}
            </div>
            <div className="text-xs text-gray-500">Top K: {topK}</div>
          </div>
        </div>
      </BaseNode>
    );
  },
);

KnowledgeNode.displayName = 'KnowledgeNode';
