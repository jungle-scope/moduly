import { useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  StartNodeData,
  WorkflowVariable,
  SelectOption,
  VariableType,
} from '../../../../types/Nodes';

export const useVariableManager = (id: string, data: StartNodeData) => {
  const { updateNodeData } = useReactFlow();
  const variables = useMemo(() => data.variables || [], [data.variables]);
  const addVariable = useCallback(() => {
    const newVar: WorkflowVariable = {
      id: crypto.randomUUID(),
      name: `var_${variables.length + 1}`,
      label: `새 변수`,
      type: 'text',
      required: true,
    };
    updateNodeData(id, {
      variables: [...variables, newVar],
    });
  }, [id, variables, updateNodeData]);

  const updateVariable = useCallback(
    (varId: string, updates: Partial<WorkflowVariable>) => {
      const newVariables = variables.map((v) =>
        v.id === varId ? { ...v, ...updates } : v,
      );
      updateNodeData(id, { variables: newVariables });
    },
    [id, variables, updateNodeData],
  );

  const deleteVariable = useCallback(
    (varId: string) => {
      const newVariables = variables.filter((v) => v.id !== varId);
      updateNodeData(id, { variables: newVariables });
    },
    [id, variables, updateNodeData],
  );

  const moveVariable = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === variables.length - 1) return;
      const newVariables = [...variables];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      // Swap
      [newVariables[index], newVariables[targetIndex]] = [
        newVariables[targetIndex],
        newVariables[index],
      ];
      updateNodeData(id, { variables: newVariables });
    },
    [id, variables, updateNodeData],
  );

  return {
    variables,
    addVariable,
    updateVariable,
    deleteVariable,
    moveVariable,
  };
};

// 변수명/라벨 검사 (Header용)
export const validateVariableName = (
  name: string,
  label: string,
  existingNames: string[],
): string | null => {
  if (!label || label.trim() === '') {
    return '표시명(Label)을 입력해주세요.';
  }

  if (!name || name.trim() === '') {
    return '변수명을 입력해주세요.';
  }

  const reservedPrefixes = ['sys', 'env', 'meta'];
  if (reservedPrefixes.some((prefix) => name.startsWith(prefix))) {
    return 'sys, env, meta로 시작하는 시스템 예약어는 사용할 수 없습니다.';
  }

  const regex = /^[a-z0-9_]+$/;
  if (!regex.test(name)) {
    return '영문 소문자, 숫자, 언더바(_)만 사용할 수 있습니다.';
  }

  if (existingNames.includes(name)) {
    return '이미 존재하는 변수명입니다.';
  }

  return null;
};

// 옵션 목록 검사 (Settings용)
export const validateVariableSettings = (
  type: VariableType,
  options: SelectOption[] | undefined,
  maxLength: number | undefined,
): string | null => {
  if (type === 'select') {
    const safeOptions = options || [];
    if (safeOptions.length === 0) {
      return '최소 1개 이상의 옵션을 추가해주세요.';
    }
    const seenValues = new Set<string>();
    for (let i = 0; i < safeOptions.length; i++) {
      const opt = safeOptions[i];
      if (!opt.label.trim()) return `${i + 1}번째 옵션의 라벨을 입력해주세요.`;
      if (!opt.value.trim()) return `${i + 1}번째 옵션의 값을 입력해주세요.`;
      if (seenValues.has(opt.value)) {
        return `옵션 값 '${opt.value}'이(가) 중복됩니다.`;
      }
      seenValues.add(opt.value);
    }
  }

  if (type === 'text' || type === 'paragraph') {
    // 값이 입력되어 있는데(undefined가 아닌데) 1보다 작으면 에러
    if (maxLength !== undefined && maxLength < 1) {
      return '최대 길이는 1 이상의 숫자여야 합니다.';
    }
  }

  return null;
};
