import React from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { BaseNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export interface AnswerNodeOutput {
  variable: string;
  value_selector: string[]; // [node_id, key]
}

export interface AnswerNodeData extends BaseNodeData {
  outputs: AnswerNodeOutput[];
}

interface AnswerNodeProps {
  id: string;
  data: AnswerNodeData;
  selected?: boolean;
}

export const AnswerNode: React.FC<AnswerNodeProps> = ({ data, selected }) => {
  const { nodes } = useWorkflowStore();

  return (
    <BaseNode data={data} selected={selected} showSourceHandle={false}>
      <div className="flex flex-col gap-2 p-1">
        <label className="text-xs font-semibold text-gray-500">출력 변수</label>

        {data.outputs?.map((output, index) => {
          const sourceNodeId = output.value_selector?.[0];
          const sourceNode = nodes.find((n) => n.id === sourceNodeId);
          const sourceTitle =
            (sourceNode?.data as { title?: string })?.title ||
            sourceNode?.type ||
            'undefined';
          const variableKey = output.value_selector?.[1] || 'undefined';

          return (
            <div
              key={`${output.variable || 'output'}-${index}`}
              className="flex flex-col gap-1 rounded border border-gray-200 p-2 bg-gray-50"
            >
              <div className="text-xs font-medium text-gray-700">
                {output.variable || '(이름 없음)'}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {sourceTitle} - {variableKey}
              </div>
            </div>
          );
        })}

        {(!data.outputs || data.outputs.length === 0) && (
          <div className="text-center text-xs text-gray-400 py-2">
            설정된 변수 없음
          </div>
        )}
      </div>
    </BaseNode>
  );
};
