import { memo } from 'react';
import { Node, NodeProps } from '@xyflow/react';
import { Bot, AlertTriangle } from 'lucide-react';

import { BaseNode } from '../../BaseNode';
import { LLMNodeData } from '../../../../types/Nodes';
import { ValidationBadge } from '../../ui/ValidationBadge';

// NOTE: [LLM] LLM 노드 박스 UI (BaseNode를 사용해 일관된 껍데기 유지)
export const LLMNode = memo(
  ({ data, selected, id }: NodeProps<Node<LLMNodeData>>) => {
    // 노드 실행 필수 요건 체크
    // 1. 프롬프트가 하나라도 있어야 함 (system_prompt, user_prompt, assistant_prompt 중 하나)
    // 2. 모델이 설정되어 있어야 함
    const hasNoPrompts = !data.system_prompt && !data.user_prompt && !data.assistant_prompt;
    const hasNoModel = !data.model_id;
    const hasValidationIssue = hasNoPrompts || hasNoModel;
    
    return (
      <BaseNode
        id={id}
        data={data}
        selected={selected}
        icon={<Bot className="text-white" />}
        iconColor="#a855f7" // purple-500
      >
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>Model</span>
            <span className="font-medium text-gray-900">
              {data.provider || '미지정'}
            </span>
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">
            {data.model_id || '모델 미지정'}
          </div>
          
          {/* 검증 실패 시에만 경고 배지 추가 */}
          {hasValidationIssue && (
            <div className="flex items-center justify-center mt-1.5">
              <ValidationBadge message="확인 필요" />
            </div>
          )}
          
          {/* 전체 너비 버전 (필요시 위 코드와 교체)
          {hasValidationIssue && (
            <div className="mt-1.5 w-full">
              <div className="w-full flex items-center justify-center bg-red-50 border border-red-300 rounded-md px-2 py-1">
                <AlertTriangle className="w-3 h-3 text-red-500 mr-1" />
                <span className="text-[11px] font-medium text-red-600">
                  확인 필요
                </span>
              </div>
            </div>
          )}
          */}
        </div>
      </BaseNode>
    );
  },
);
LLMNode.displayName = 'LLMNode';
