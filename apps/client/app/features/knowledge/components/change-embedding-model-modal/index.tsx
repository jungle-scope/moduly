'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Check,
  Cpu,
} from 'lucide-react';

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
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

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
              !json.find(
                (m: EmbeddingModelOption) =>
                  m.model_id_for_api_call === currentModel,
              )
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

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getSelectedModelName = () => {
    const model = modelOptions.find(
      (m) => m.model_id_for_api_call === selectedModel,
    );
    return model?.name || selectedModel;
  };

  const groupedModels = modelOptions.reduce(
    (acc, model) => {
      const p = model.provider_name || 'Unknown';
      if (!acc[p]) acc[p] = [];
      acc[p].push(model);
      return acc;
    },
    {} as Record<string, EmbeddingModelOption[]>,
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              임베딩 모델 변경
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Alert - Larger Icon */}
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 rounded-full">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-sm space-y-1">
              <p className="font-bold text-amber-800 dark:text-amber-200">
                모든 문서가 재인덱싱됩니다
              </p>
              <p className="text-amber-700 dark:text-amber-300">
                문서 수에 따라 시간이 소요될 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Current Model Display */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            현재 모델
          </label>
          <div className="px-3 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            {currentModel}
          </div>
        </div>

        {/* New Model Selection - Custom Select */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            새로운 모델 선택 *
          </label>
          {isFetchingModels ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin" />
              모델 목록 불러오는 중...
            </div>
          ) : (
            <div ref={selectRef} className="relative">
              {/* Custom Select Trigger */}
              <button
                type="button"
                onClick={() => !isLoading && setIsSelectOpen(!isSelectOpen)}
                disabled={isLoading}
                className={`w-full px-3 py-2.5 text-left border rounded-lg flex items-center justify-between transition-colors ${
                  isSelectOpen
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                } bg-white dark:bg-gray-700 disabled:opacity-50`}
              >
                <span className="text-sm text-gray-900 dark:text-white truncate">
                  {getSelectedModelName()}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    isSelectOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Custom Dropdown */}
              {isSelectOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {Object.entries(groupedModels).map(([provider, models]) => (
                    <div key={provider}>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 uppercase tracking-wider sticky top-0">
                        {provider}
                      </div>
                      {models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.model_id_for_api_call);
                            setIsSelectOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            selectedModel === model.model_id_for_api_call
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <span className="truncate">{model.name}</span>
                          {selectedModel === model.model_id_for_api_call && (
                            <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              isLoading || selectedModel === currentModel || isFetchingModels
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm flex items-center gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLoading ? '변경 중...' : '모델 변경 및 재학습'}
          </button>
        </div>
      </div>
    </div>
  );
}
