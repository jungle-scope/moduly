'use client';

import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ChangeEmbeddingModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onConfirm: (newModel: string) => Promise<void>;
}

type EmbeddingModelOption = {
  id: string;
  model_id_for_api_call: string;
  name: string;
  type: string;
  provider_name?: string;
};

export default function ChangeEmbeddingModelModal({
  isOpen,
  onClose,
  currentModel,
  onConfirm,
}: ChangeEmbeddingModelModalProps) {
  const [modelOptions, setModelOptions] = useState<EmbeddingModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  // 모델 목록 가져오기
  useEffect(() => {
    if (isOpen) {
      const fetchModels = async () => {
        try {
          setIsFetchingModels(true);
          const res = await fetch(`/api/v1/llm/my-embedding-models`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (res.ok) {
            const json = await res.json();
            setModelOptions(json);
            // 현재 모델이 목록에 없으면 첫 번째 모델을 선택
            if (
              json.length > 0 &&
              !json.find((m: any) => m.model_id_for_api_call === currentModel)
            ) {
              setSelectedModel(json[0].model_id_for_api_call);
            }
          }
        } catch (err) {
          console.error('Failed to fetch embedding models', err);
        } finally {
          setIsFetchingModels(false);
        }
      };
      fetchModels();
    }
  }, [isOpen, currentModel]);

  const handleConfirm = async () => {
    if (selectedModel === currentModel) {
      onClose();
      return;
    }
    try {
      setIsLoading(true);
      await onConfirm(selectedModel);
      onClose();
    } catch (error) {
      console.error('Failed to change model:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            임베딩 모델 변경
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            disabled={isLoading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Warning Alert */}
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
              <p className="font-semibold">모든 문서가 재인덱싱됩니다</p>
              <p className="text-yellow-700 dark:text-yellow-300">
                모델을 변경하면 기존 벡터 데이터가 삭제되고 새로운 모델로 다시
                임베딩됩니다. 문서 수에 따라 시간이 소요될 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Current Model Display */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            현재 모델
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-300">
            {currentModel}
          </div>
        </div>

        {/* New Model Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            새로운 모델 선택 *
          </label>
          {isFetchingModels ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              모델 목록 불러오는 중...
            </div>
          ) : (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isLoading}
            >
              {Object.entries(
                modelOptions.reduce(
                  (acc, model) => {
                    const p = model.provider_name || 'Unknown';
                    if (!acc[p]) acc[p] = [];
                    acc[p].push(model);
                    return acc;
                  },
                  {} as Record<string, EmbeddingModelOption[]>,
                ),
              ).map(([provider, models]) => (
                <optgroup key={provider} label={provider.toUpperCase()}>
                  {models.map((m) => (
                    <option key={m.id} value={m.model_id_for_api_call}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              isLoading || selectedModel === currentModel || isFetchingModels
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '변경 중...' : '변경 및 재인덱싱 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}
