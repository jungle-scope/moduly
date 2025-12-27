import React from 'react';
import { WorkflowVariable } from '../../../../types/Nodes';
import { validateVariableSettings } from '../hooks/useVariableManager';
import { MaxLengthSetting } from './MaxLengthSetting';
import { SelectSetting } from './SelectSetting';

interface VariableSettingsProps {
  variable: WorkflowVariable;
  allVariables?: WorkflowVariable[];
  onUpdate: (id: string, updates: Partial<WorkflowVariable>) => void;
}

export const VariableSettings = ({
  variable,
  onUpdate,
}: VariableSettingsProps) => {
  // 유효성 검사 에러 (설정 관련)
  const settingError = validateVariableSettings(
    variable.type,
    variable.options,
    variable.maxLength,
  );

  return (
    <div className="pl-6 text-xs text-muted-foreground">
      {/* 1. 텍스트/문단 타입일 때: 최대 길이 설정 */}
      {(variable.type === 'text' || variable.type === 'paragraph') && (
        <MaxLengthSetting
          maxLength={variable.maxLength}
          onChange={(newMaxLength) =>
            onUpdate(variable.id, { maxLength: newMaxLength })
          }
          error={settingError}
        />
      )}

      {/* 2. 선택(Select) 타입일 때: 옵션 목록 설정 */}
      {variable.type === 'select' && (
        <SelectSetting
          options={variable.options}
          onChange={(newOptions) =>
            onUpdate(variable.id, { options: newOptions })
          }
          error={settingError}
        />
      )}
    </div>
  );
};
