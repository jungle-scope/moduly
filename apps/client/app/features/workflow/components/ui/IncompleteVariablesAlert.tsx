import { VariableWithSelector } from '@/app/features/workflow/utils/validationUtils';
import { ValidationAlert } from './ValidationAlert';

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
      <p className="font-semibold flex items-center gap-1">
        ⚠️ 변수의 노드/출력이 선택되지 않았습니다:
      </p>
      <ul className="list-disc list-inside">
        {variables.map((v, i) => (
          <li key={i}>{v.name}</li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-orange-500">
        실행 시 빈 값으로 대체됩니다.
      </p>
    </div>
  );
}
