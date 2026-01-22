import { VariableWithSelector } from '@/app/features/workflow/utils/validationUtils';

interface IncompleteVariablesAlertProps {
  variables: VariableWithSelector[];
}

export function IncompleteVariablesAlert({
  variables,
}: IncompleteVariablesAlertProps) {
  if (!variables || variables.length === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded p-2 text-orange-700 text-xs mt-2">
      <div className="flex items-start gap-1.5">
        <span>⚠️</span>
        <div className="flex flex-col gap-0.5">
          <span>
            <strong>
              {variables
                .map((v, i) => v.name?.trim() || `입력변수 ${i + 1}`)
                .join(', ')}
            </strong>
            {variables.length === 1 ? '이' : '가'} 연결되지 않았어요.
          </span>
          <span className="text-[10px] text-orange-500">
            연결할 노드와 출력을 선택해주세요.
          </span>
        </div>
      </div>
    </div>
  );
}
