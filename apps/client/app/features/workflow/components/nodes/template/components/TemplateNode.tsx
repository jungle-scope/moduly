import React from 'react';
import { BaseNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

export interface TemplateVariable {
  name: string;
  value_selector: string[]; // [node_id, variable_key]
}

export interface TemplateNodeData extends BaseNodeData {
  template: string;
  variables: TemplateVariable[];
}

interface TemplateNodeProps {
  id: string;
  data: TemplateNodeData;
  selected?: boolean;
}

export const TemplateNode: React.FC<TemplateNodeProps> = ({
  data,
  selected,
}) => {
  return (
    <BaseNode data={data} selected={selected}>
      <div className="flex flex-col gap-2 p-1">
        <div className="text-xs text-gray-500">
          {/* Shell 구현: 아직 내용 없음 */}
          <p>템플릿 노드 (준비 중)</p>
          <div className="mt-2 rounded bg-gray-50 p-2 text-[10px] text-gray-400">
            템플릿과 변수를 설정하여 텍스트를 생성합니다.
          </div>
        </div>
      </div>
    </BaseNode>
  );
};
