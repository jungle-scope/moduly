import React from 'react';
import { LayoutTemplate } from 'lucide-react';
import { BaseNodeData, TemplateNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

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
    <BaseNode
      data={data}
      selected={selected}
      icon={<LayoutTemplate className="text-white" />}
      iconColor="#ec4899" // pink-500
    >
      <div className="flex flex-col gap-2 p-1">
        <div className="text-xs text-gray-500">
          <p className="text-[10px] leading-snug">
            템플릿과 변수를 설정하여 텍스트를 생성
          </p>
        </div>
      </div>
    </BaseNode>
  );
};
