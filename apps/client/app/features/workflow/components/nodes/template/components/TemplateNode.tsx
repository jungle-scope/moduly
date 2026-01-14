import React, { useMemo } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { BaseNodeData, TemplateNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';
import { ValidationBadge } from '../../../ui/ValidationBadge';
import { hasIncompleteVariables } from '../../../../utils/validationUtils';

interface TemplateNodeProps {
  id: string;
  data: TemplateNodeData;
  selected?: boolean;
}

export const TemplateNode: React.FC<TemplateNodeProps> = ({
  id,
  data,
  selected,
}) => {
  // 미등록 변수 검사
  const missingVariables = useMemo(() => {
    const template = data.template || '';
    const registeredNames = new Set(
      (data.variables || []).map((v) => v.name?.trim()).filter(Boolean),
    );
    const errors: string[] = [];

    const regex = /{{\s*([^}]+?)\s*}}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (varName && !registeredNames.has(varName)) {
        errors.push(varName);
      }
    }

    return Array.from(new Set(errors));
  }, [data.template, data.variables]);

  // 불완전한 변수 검사 (이름은 있지만 value_selector가 비어있는 경우)
  const incompleteVars = useMemo(
    () => hasIncompleteVariables(data.variables),
    [data.variables]
  );

  const hasValidationIssue = missingVariables.length > 0 || incompleteVars;

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      icon={<LayoutTemplate className="text-white" />}
      iconColor="#ec4899" // pink-500
    >
      <div className="flex flex-col gap-1">
        <div className="text-xs text-gray-500">
          {data.variables?.length || 0}개 입력 변수
        </div>
        {hasValidationIssue && <ValidationBadge />}
      </div>
    </BaseNode>
  );
};
