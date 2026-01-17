import { ModelSelectDropdown } from '../nodes/llm/components/ModelSelectDropdown';
import { type ModelOption } from '@/app/features/workflow/utils/llmModelUtils';

type GroupedModels = Array<{ provider: string; models: ModelOption[] }>;

interface WizardModelSelectProps {
  label?: string;
  value: string;
  onChange: (modelId: string) => void;
  models: ModelOption[];
  groupedModels?: GroupedModels;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  layout?: 'stacked' | 'inline';
  containerClassName?: string;
}

export function WizardModelSelect({
  label = '모델 선택',
  value,
  onChange,
  models,
  groupedModels,
  loading,
  disabled = false,
  placeholder = '모델을 선택하세요',
  layout = 'stacked',
  containerClassName = '',
}: WizardModelSelectProps) {
  const showEmpty = !loading && models.length === 0;
  const dropdown = loading ? (
    <div className="text-xs text-gray-400">모델 로딩 중...</div>
  ) : (
    <ModelSelectDropdown
      value={value}
      onChange={onChange}
      models={models}
      groupedModels={groupedModels}
      placeholder={placeholder}
      disabled={disabled || models.length === 0}
    />
  );

  if (layout === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${containerClassName}`}>
        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
          {label}:
        </span>
        <div className="flex-1 min-w-0">
          {dropdown}
          {showEmpty && (
            <div className="mt-1 text-xs text-gray-400">
              사용 가능한 모델이 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <label className="text-sm font-semibold text-gray-700 mb-2 block">
        {label}
      </label>
      {dropdown}
      {showEmpty && (
        <div className="mt-1 text-xs text-gray-400">
          사용 가능한 모델이 없습니다.
        </div>
      )}
    </div>
  );
}
