import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  groupModelsByProvider,
  isChatModelOption,
  pickPreferredModelId,
  type ModelOption,
} from '@/app/features/workflow/utils/llmModelUtils';

export const useWizardModels = (
  isOpen: boolean,
  defaultModelIds: string[],
) => {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

  const chatModelOptions = useMemo(
    () => modelOptions.filter(isChatModelOption),
    [modelOptions],
  );
  const groupedModelOptions = useMemo(
    () => groupModelsByProvider(chatModelOptions),
    [chatModelOptions],
  );

  const fetchModels = useCallback(async () => {
    try {
      setLoadingModels(true);
      const res = await fetch('/api/v1/llm/my-models', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setModelOptions(data);
      } else {
        setModelOptions([]);
      }
    } catch {
      setModelOptions([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedModelId('');
    fetchModels();
  }, [isOpen, fetchModels]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedModelId && chatModelOptions.length > 0) {
      setSelectedModelId(
        pickPreferredModelId(chatModelOptions, defaultModelIds),
      );
    }
  }, [isOpen, selectedModelId, chatModelOptions, defaultModelIds]);

  return {
    modelOptions,
    loadingModels,
    selectedModelId,
    setSelectedModelId,
    chatModelOptions,
    groupedModelOptions,
    refreshModels: fetchModels,
  };
};
