import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// Provider 로고 SVG 컴포넌트들
const ProviderLogos: Record<string, React.FC<{ className?: string }>> = {
  openai: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  ),
  anthropic: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.564h6.624l1.368 3.564h3.744L10.152 3.541zm-.264 11.07L9 7.476l2.568 7.135z" />
    </svg>
  ),
  google: ({ className }) => (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      {/* Gemini 스파클 로고 */}
      <path
        d="M14 28C14 26.0633 13.6267 24.2433 12.88 22.54C12.1567 20.8367 11.165 19.355 9.905 18.095C8.645 16.835 7.16333 15.8433 5.46 15.12C3.75667 14.3733 1.93667 14 0 14C1.93667 14 3.75667 13.6383 5.46 12.915C7.16333 12.1683 8.645 11.165 9.905 9.905C11.165 8.645 12.1567 7.16333 12.88 5.46C13.6267 3.75667 14 1.93667 14 0C14 1.93667 14.3617 3.75667 15.085 5.46C15.8317 7.16333 16.835 8.645 18.095 9.905C19.355 11.165 20.8367 12.1683 22.54 12.915C24.2433 13.6383 26.0633 14 28 14C26.0633 14 24.2433 14.3733 22.54 15.12C20.8367 15.8433 19.355 16.835 18.095 18.095C16.835 19.355 15.8317 20.8367 15.085 22.54C14.3617 24.2433 14 26.0633 14 28Z"
        fill="url(#gemini-gradient)"
      />
      <defs>
        <linearGradient id="gemini-gradient" x1="0" y1="14" x2="28" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
    </svg>
  ),
  xai: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.002 5.436L9.65 16.418v5.527H12.35v-5.527L20.002 5.436h-3.236L12 12.88L7.238 5.436H2.002ZM15.65 18.055L20.002 24h3.237l-5.454-7.456L15.65 18.055ZM.761 24L5.112 18.055l2.135 1.511L3.996 24H.761Z" />
    </svg>
  ),
  deepseek: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S6.698 2.4 12 2.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zm-1.2-14.4v9.6h2.4V7.2h-2.4z" />
    </svg>
  ),
  unknown: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
    </svg>
  ),
};

// Provider 색상 맵
const ProviderColors: Record<string, string> = {
  openai: 'text-[#10A37F]',
  anthropic: 'text-[#D97757]',
  google: 'text-[#4285F4]',
  xai: 'text-black',
  deepseek: 'text-[#4D6BFE]',
  unknown: 'text-gray-400',
};

type ModelOption = {
  id: string;
  model_id_for_api_call: string;
  name: string;
  type: string;
  provider_name?: string;
  is_active: boolean;
};

interface ModelSelectDropdownProps {
  value: string;
  onChange: (modelId: string) => void;
  models: ModelOption[];
  disabled?: boolean;
  placeholder?: string;
  groupedModels?: Array<{ provider: string; models: ModelOption[] }>;
}

// Provider 이름 정규화
const normalizeProviderName = (name: string): string => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('openai')) return 'openai';
  if (lower.includes('anthropic')) return 'anthropic';
  if (lower.includes('google') || lower.includes('gemini')) return 'google';
  if (lower.includes('xai') || lower.includes('grok')) return 'xai';
  if (lower.includes('deepseek')) return 'deepseek';
  return 'unknown';
};

const getProviderLogo = (providerName: string) => {
  const normalizedName = normalizeProviderName(providerName);
  return ProviderLogos[normalizedName] || ProviderLogos.unknown;
};

const getProviderColor = (providerName: string) => {
  const normalizedName = normalizeProviderName(providerName);
  return ProviderColors[normalizedName] || ProviderColors.unknown;
};

export function ModelSelectDropdown({
  value,
  onChange,
  models,
  disabled = false,
  placeholder = '모델을 선택하세요',
  groupedModels,
}: ModelSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 선택된 모델 찾기
  const selectedModel = useMemo(
    () => models.find((m) => m.model_id_for_api_call === value),
    [models, value],
  );

  // 검색 필터링
  const filteredGroupedModels = useMemo(() => {
    if (!groupedModels) return [];
    if (!searchQuery.trim()) return groupedModels;

    const query = searchQuery.toLowerCase();
    return groupedModels
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.model_id_for_api_call.toLowerCase().includes(query) ||
            group.provider.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [groupedModels, searchQuery]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 열릴 때 검색창 포커스
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const ProviderLogo = selectedModel
    ? getProviderLogo(selectedModel.provider_name || '')
    : null;

  return (
    <div ref={dropdownRef} className="relative">
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm transition-all ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
            : 'border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
        } ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModel && ProviderLogo && (
            <ProviderLogo
              className={`w-4 h-4 flex-shrink-0 ${getProviderColor(selectedModel.provider_name || '')}`}
            />
          )}
          <span className={`truncate ${!selectedModel ? 'text-gray-400' : ''}`}>
            {selectedModel?.name || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 드롭다운 팝오버 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
          {/* 검색창 */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="모델 검색..."
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-md focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-100 rounded"
                >
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* 모델 목록 */}
          <div className="max-h-64 overflow-y-auto">
            {filteredGroupedModels.length > 0 ? (
              filteredGroupedModels.map((group, groupIdx) => {
                const GroupLogo = getProviderLogo(group.provider);
                const groupColor = getProviderColor(group.provider);

                return (
                  <div key={group.provider}>
                    {/* Provider 헤더 */}
                    <div
                      className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 ${
                        groupIdx > 0 ? 'border-t' : ''
                      }`}
                    >
                      <GroupLogo className={`w-3.5 h-3.5 ${groupColor}`} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {group.provider}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ({group.models.length})
                      </span>
                    </div>

                    {/* 모델 리스트 */}
                    {group.models.map((model) => {
                      const isSelected =
                        model.model_id_for_api_call === value;
                      const ModelLogo = getProviderLogo(
                        model.provider_name || group.provider,
                      );
                      const modelColor = getProviderColor(
                        model.provider_name || group.provider,
                      );

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() =>
                            handleSelect(model.model_id_for_api_call)
                          }
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-50 text-blue-700'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <ModelLogo
                            className={`w-4 h-4 flex-shrink-0 ${modelColor}`}
                          />
                          <span className="truncate">{model.name}</span>
                          {isSelected && (
                            <span className="ml-auto text-blue-600 text-xs">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                {searchQuery
                  ? '일치하는 모델이 없습니다'
                  : '사용 가능한 모델이 없습니다'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
