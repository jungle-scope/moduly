import React, { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { AnswerNodeData, StartNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export const AnswerNode = memo(
  ({ data, selected }: NodeProps<Node<AnswerNodeData>>) => {
    const { nodes } = useWorkflowStore();

    return (
      <BaseNode data={data} selected={selected} showSourceHandle={false}>
        <div className="flex flex-col gap-2 p-1">
          <label className="text-xs font-semibold text-gray-500">
            출력 변수
          </label>

          {data.outputs?.map((output, index) => {
            const sourceNodeId = output.value_selector?.[0];
            const variableId = output.value_selector?.[1];
            const sourceNode = nodes.find((n) => n.id === sourceNodeId);
            const sourceTitle =
              (sourceNode?.data as { title?: string })?.title ||
              sourceNode?.type ||
              'undefined';

            // 변수 ID를 기반으로 현재 변수 이름 조회
            let variableKey = 'undefined';
            if (
              sourceNode &&
              (sourceNode.type as string) === 'startNode' &&
              variableId
            ) {
              const startData = sourceNode.data as unknown as StartNodeData;
              const variable = startData.variables?.find(
                (v) => v.id === variableId,
              );
              variableKey = variable?.name || '(삭제된 변수)';
            } else if (variableId) {
              variableKey = variableId;
            }

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
  },
);
AnswerNode.displayName = 'AnswerNode';
