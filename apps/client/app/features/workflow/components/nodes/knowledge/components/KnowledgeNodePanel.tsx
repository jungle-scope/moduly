import React from 'react';

import { KnowledgeNodeData } from '../../../../types/Nodes';

interface KnowledgeNodePanelProps {
  nodeId: string;
  data: KnowledgeNodeData;
}

export const KnowledgeNodePanel: React.FC<KnowledgeNodePanelProps> = ({
  data,
}) => {
  const knowledgeBaseName = data.knowledgeBaseName || '지식 베이스 미선택';
  const topK = data.topK ?? 3;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        지식 노드 UI만 먼저 준비했습니다. 곧 설정 옵션과 동작이 추가될 예정이에요.
      </div>
      <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
        <div className="text-xs text-gray-500">Knowledge Base</div>
        <div className="text-sm font-medium text-gray-900">
          {knowledgeBaseName}
        </div>
        <div className="mt-1 text-xs text-gray-500">Top K (기본값): {topK}</div>
      </div>
      <div className="rounded border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-700">
        예상 출력: context, metadata (임시 자리표시자)
      </div>
    </div>
  );
};
