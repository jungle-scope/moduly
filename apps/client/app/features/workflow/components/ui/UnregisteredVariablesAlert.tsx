import { ValidationAlert } from './ValidationAlert';

interface UnregisteredVariablesAlertProps {
  variables: string[];
}

export function UnregisteredVariablesAlert({
  variables,
}: UnregisteredVariablesAlertProps) {
  if (!variables || variables.length === 0) {
    return null;
  }

  return (
    <ValidationAlert
      message={
        <>
          <p className="font-semibold mb-1">
            ⚠️ 등록되지 않은 입력변수가 감지되었습니다:
          </p>
          <ul className="list-disc list-inside mt-1 font-normal">
            {variables.map((variable, index) => (
              <li key={index}>{variable}</li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-red-500 font-normal">
            입력변수 섹션에 변수를 등록해주세요.
          </p>
        </>
      }
    />
  );
}
