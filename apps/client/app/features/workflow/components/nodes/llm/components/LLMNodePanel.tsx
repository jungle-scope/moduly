import { useCallback, useEffect, useMemo, useState } from 'react';

import { LLMNodeData } from '../../../../types/Nodes';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

type ProviderOption = {
  id: string;
  name: string;
  providerType: string;
  models: string[];
  baseUrl?: string;
};

interface LLMNodePanelProps {
  nodeId: string;
  data: LLMNodeData;
}

export function LLMNodePanel({ nodeId, data }: LLMNodePanelProps) {
  // NOTE: [LLM] 기존 StartNodePanel 패턴을 따라간 LLM 설정 패널
  const { updateNodeData, nodes } = useWorkflowStore();
  const [referencedInput, setReferencedInput] = useState('');
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerError, setProviderError] = useState<string | null>(null);

  const availableContextVars = useMemo(() => {
    // Start 노드 변수명을 옵션으로 활용 (추후 이전 노드 output으로 대체 예정)
    return nodes
      .filter((n) => n.type === 'startNode')
      .flatMap((n: any) => n.data?.variables || [])
      .map((v: any) => v.name)
      .filter(Boolean);
  }, [nodes]);

  const handleFieldChange = useCallback(
    (field: keyof LLMNodeData, value: any) => {
      updateNodeData(nodeId, { [field]: value });
    },
    [nodeId, updateNodeData],
  );

  const handleAddReferenced = () => {
    const trimmed = referencedInput.trim();
    if (!trimmed) return;
    handleFieldChange('referenced_variables', [
      ...(data.referenced_variables || []),
      trimmed,
    ]);
    setReferencedInput('');
  };

  const handleRemoveReferenced = (name: string) => {
    handleFieldChange(
      'referenced_variables',
      (data.referenced_variables || []).filter((v) => v !== name),
    );
  };

  // 임시: 모든 provider 목록을 가져와 선택하도록 제공 (나중에 per-user로 변경 예정)
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/llm/providers', {
          credentials: 'include',
        });
        const body = await res.json();
        if (!res.ok) {
          setProviderError(
            `Provider 목록 조회 실패 (status ${res.status}): ${body?.detail || body?.message || '알 수 없는 오류'}`,
          );
          return;
        }

        const parsed: ProviderOption[] = (body as any[]).map((p) => {
          // encrypted_config는 마스킹된 JSON 문자열 (apiKey는 마스킹, model/baseUrl은 그대로)
          const models: string[] = [];
          let baseUrl: string | undefined;

          const cfgStr = p.credentials?.[0]?.encrypted_config;
          if (cfgStr) {
            try {
              const cfg = JSON.parse(cfgStr);
              if (cfg.model) models.push(cfg.model);
              if (cfg.baseUrl) baseUrl = cfg.baseUrl;
            } catch (e) {
              // 파싱 실패 시 무시
            }
          }

          return {
            id: p.id,
            name: p.provider_name || p.provider_type || 'provider',
            providerType: p.provider_type || 'openai',
            models,
            baseUrl,
          };
        });

        setProviders(parsed);
      } catch (error) {
        setProviderError(
          error instanceof Error ? error.message : 'Provider 목록 조회 실패',
        );
      }
    };

    fetchProviders();
  }, []);

  useEffect(() => {
    if (providers.length === 0 || data.provider) return;

    const first = providers[0];
    handleFieldChange('provider', first.providerType);

    if (!data.model_id && first.models.length > 0) {
      handleFieldChange('model_id', first.models[0]);
    }
  }, [providers, data.provider, data.model_id, handleFieldChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Model만 입력 가능, Provider 선택은 임시로 비활성화 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-700">모델 설정</span>
            <span className="text-[11px] text-gray-500">
              Provider는 첫 번째 등록된 값으로 자동 선택됩니다.
            </span>
          </div>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          {providerError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {providerError}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Model</label>
            <input
              type="text"
              value={data.model_id || ''}
              onChange={(e) => handleFieldChange('model_id', e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="예: gpt-4o"
            />
          </div>
        </div>
      </div>

      {/* Prompts */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <span className="text-sm font-semibold text-gray-700">프롬프트</span>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          {[
            { key: 'system_prompt', label: 'System Prompt' },
            { key: 'user_prompt', label: 'User Prompt' },
            { key: 'assistant_prompt', label: 'Assistant Prompt' },
          ].map(({ key, label }) => (
            <div className="flex flex-col gap-1" key={key}>
              <label className="text-xs font-medium text-gray-700">
                {label}
              </label>
              <textarea
                value={(data as any)[key] || ''}
                onChange={(e) => handleFieldChange(key as any, e.target.value)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 min-h-[80px]"
                placeholder={`${label}을 입력하세요`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Referenced variables */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            참조 변수 (referenced_variables)
          </span>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={referencedInput}
              onChange={(e) => setReferencedInput(e.target.value)}
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="변수 이름 입력 후 추가"
            />
            <button
              onClick={handleAddReferenced}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              추가
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(data.referenced_variables || []).length === 0 && (
              <span className="text-xs text-gray-400">
                추가된 변수가 없습니다.
              </span>
            )}
            {(data.referenced_variables || []).map((name) => (
              <span
                key={name}
                className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
              >
                {name}
                <button
                  onClick={() => handleRemoveReferenced(name)}
                  className="text-gray-500 hover:text-gray-900"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Context variable */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <span className="text-sm font-semibold text-gray-700">
            컨텍스트 변수 (context_variable)
          </span>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          <select
            value={data.context_variable || ''}
            onChange={(e) => handleFieldChange('context_variable', e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
          >
            <option value="">선택 안 함</option>
            {availableContextVars.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400">
            TODO: 이전 노드 output을 옵션으로 불러오는 로직 확정 후 대체 예정.
          </p>
        </div>
      </div>

    </div>
  );
}
