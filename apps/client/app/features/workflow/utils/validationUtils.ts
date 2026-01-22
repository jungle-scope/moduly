export interface VariableWithSelector {
  value_selector?: string[];
  [key: string]: any;
}

/**
 * 변수 목록 중 value_selector가 비어있는 항목이 있는지 확인합니다.
 * @param variables 검사할 변수 목록
 * @returns 미완성된 변수가 하나라도 있으면 true
 */
export const hasIncompleteVariables = (
  variables?: VariableWithSelector[],
): boolean => {
  if (!variables || variables.length === 0) {
    return false;
  }

  return variables.some((variable) => {
    const selector = variable.value_selector;
    // value_selector가 없거나, 배열이 비어있거나, nodeId나 outputKey가 없는 경우
    return !selector || selector.length < 2 || !selector[0] || !selector[1];
  });
};

/**
 * 변수 목록 중 value_selector가 비어있는 항목들만 반환합니다.
 * @param variables 검사할 변수 목록
 * @returns 미완성된 변수 목록
 */
export const getIncompleteVariables = (
  variables?: VariableWithSelector[],
): VariableWithSelector[] => {
  if (!variables || variables.length === 0) {
    return [];
  }

  return variables.filter((variable) => {
    const selector = variable.value_selector;
    return !selector || selector.length < 2 || !selector[0] || !selector[1];
  });
};
