import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { LLMNodeData } from '../../../../types/Nodes';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';

// Backend Response Type matches LLMModelResponse
type ModelOption = {
  id: string; // UUID
  model_id_for_api_call: string; // "gpt-4o"
  name: string;
  type: string;
  provider_name?: string;
  is_active: boolean;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';

interface LLMNodePanelProps {
  nodeId: string;
  data: LLMNodeData;
}

export function LLMNodePanel({ nodeId, data }: LLMNodePanelProps) {
  const router = useRouter();
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);

  // 자동완성 상태
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);
  const userPromptRef = useRef<HTMLTextAreaElement>(null);
  const assistantPromptRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [activePromptField, setActivePromptField] = useState<
    'system_prompt' | 'user_prompt' | 'assistant_prompt' | null
  >(null);

  // Upstream 노드 필터링 (외부 유틸리티 사용)
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleFieldChange = useCallback(
    (field: keyof LLMNodeData, value: any) => {
      updateNodeData(nodeId, { [field]: value });
    },
    [nodeId, updateNodeData],
  );

  const handleAddVariable = () => {
    handleFieldChange('referenced_variables', [
      ...(data.referenced_variables || []),
      { name: '', value_selector: [] },
    ]);
  };

  const handleRemoveVariable = (index: number) => {
    const newVars = [...(data.referenced_variables || [])];
    newVars.splice(index, 1);
    handleFieldChange('referenced_variables', newVars);
  };

  const handleUpdateVariable = (
    index: number,
    field: 'name' | 'value_selector',
    value: any,
  ) => {
    const newVars = [...(data.referenced_variables || [])];
    newVars[index] = { ...newVars[index], [field]: value };
    handleFieldChange('referenced_variables', newVars);
  };

  const handleSelectorUpdate = (
    index: number,
    position: 0 | 1,
    value: string,
  ) => {
    const newVars = [...(data.referenced_variables || [])];
    const currentSelector = [...(newVars[index].value_selector || [])];

    if (currentSelector.length < 2) {
      currentSelector[0] = currentSelector[0] || '';
      currentSelector[1] = currentSelector[1] || '';
    }

    currentSelector[position] = value;
    if (position === 0) {
      currentSelector[1] = '';
    }

    newVars[index] = { ...newVars[index], value_selector: currentSelector };
    handleFieldChange('referenced_variables', newVars);
  };

  // 자동완성: {{ 입력 감지
  const handleKeyUp = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    field: 'system_prompt' | 'user_prompt' | 'assistant_prompt',
  ) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;

    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      const rect = target.getBoundingClientRect();
      setSuggestionPos({
        top: rect.top + 100,
        left: rect.left + 20,
      });
      setActivePromptField(field);
      setShowSuggestions(true);
    } else {
      const lastOpen = value.lastIndexOf('{{', selectionEnd);
      const lastClose = value.lastIndexOf('}}', selectionEnd);
      if (lastOpen === -1 || lastClose > lastOpen) {
        setShowSuggestions(false);
      }
    }
  };

  // 자동완성: 변수 삽입
  const insertVariable = (varName: string) => {
    if (!activePromptField) return;

    const refMap = {
      system_prompt: systemPromptRef,
      user_prompt: userPromptRef,
      assistant_prompt: assistantPromptRef,
    };

    const textarea = refMap[activePromptField].current;
    if (!textarea) return;

    const currentValue = (data as any)[activePromptField] || '';
    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);
      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      handleFieldChange(activePromptField, newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Fetch Available Models for User
  useEffect(() => {
    const fetchMyModels = async () => {
      try {
        // Backend extracts user_id from auth cookie
        const res = await fetch(`${API_BASE_URL}/llm/my-models`, {
          credentials: 'include',
        });
        const body = await res.json();
        if (!res.ok) {
          setModelError(
            `모델 목록 조회 실패 (status ${res.status}): ${body?.detail || body?.message || '알 수 없는 오류'}`,
          );
          return;
        }

        setModelOptions(body as ModelOption[]);
      } catch (error) {
        setModelError(
          error instanceof Error ? error.message : '모델 목록 조회 실패',
        );
      }
    };

    fetchMyModels();
  }, []);

  // Set default model if none selected
  useEffect(() => {
    if (modelOptions.length > 0 && !data.model_id) {
      handleFieldChange('model_id', modelOptions[0].model_id_for_api_call);
    }
  }, [modelOptions, data.model_id, handleFieldChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Model Selection (Dropdown) */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-700">
              모델 설정
            </span>
            <span className="text-[11px] text-gray-500">
              사용 가능한 모델 목록 (등록된 Credential 기준)
            </span>
          </div>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          {modelError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {modelError}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Model</label>
            {modelOptions.length > 0 ? (
                <select
                    value={data.model_id || ''}
                    onChange={(e) => handleFieldChange('model_id', e.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                >
                    {/* Define grouped structure inline or use helper logic above */}
                    {Object.entries(
                        modelOptions.filter(m => {
                            // Filter out non-chat models to declutter UI
                            const id = m.model_id_for_api_call.toLowerCase();
                            // Exclude embeddings, audio (tts, speech), image (imagen, veo), and obscure preview types not suitable for chat node
                            if (id.includes('embedding')) return false;
                            if (id.includes('bison')) return false; // Legacy PaLM text/chat separated, usually chaotic
                            if (id.includes('gecko')) return false; // Usually embeddings
                            if (id.includes('imagen')) return false;
                            if (id.includes('veo')) return false;
                            if (id.includes('tts')) return false;
                            if (id.includes('speech')) return false;
                            if (m.type === 'embedding') return false; 
                            return true;
                        }).reduce((acc, model) => {
                            const p = model.provider_name || 'Unknown';
                            if (!acc[p]) acc[p] = [];
                            acc[p].push(model);
                            return acc;
                        }, {} as Record<string, ModelOption[]>)
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
            ) : (
                <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded border border-gray-200 items-center justify-center text-center">
                    <span className="text-xs text-gray-500">
                        사용 가능한 모델이 없습니다.
                    </span>
                    <button
                        onClick={() => router.push('/settings/provider')}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                    >
                        Provider 설정하러 가기 →
                    </button>
                </div>
            )}
           
          </div>
        </div>
      </div>

      {/* 2. Referenced Variables (Moved Up) */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            참조 변수 (Referenced Variables)
          </span>
          <button
            onClick={handleAddVariable}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add Variable
          </button>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-2">
          <p className="text-xs text-gray-500 mb-1">
            프롬프트에서 사용할 변수를 정의하고, 이전 노드의 출력값과
            연결하세요.
          </p>

          <div className="flex flex-col gap-3">
            {(data.referenced_variables || []).map((variable, index) => {
              const selectedNodeId = variable.value_selector?.[0] || '';
              const selectedVarKey = variable.value_selector?.[1] || '';

              const selectedNode = nodes.find((n) => n.id === selectedNodeId);
              const availableOutputs = selectedNode
                ? getNodeOutputs(selectedNode)
                : [];

              return (
                <div
                  key={index}
                  className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      Var #{index + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveVariable(index)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex flex-row gap-2 items-center">
                    {/* Variable Name Input */}
                    <div className="flex-[2]">
                      <input
                        type="text"
                        className="w-full rounded border border-gray-300 p-1.5 text-xs"
                        placeholder="변수명"
                        value={variable.name}
                        onChange={(e) =>
                          handleUpdateVariable(index, 'name', e.target.value)
                        }
                      />
                    </div>

                    {/* Node Selection Dropdown */}
                    <div className="flex-[3]">
                      <select
                        className="w-full rounded border border-gray-300 p-1.5 text-xs truncate"
                        value={selectedNodeId}
                        onChange={(e) =>
                          handleSelectorUpdate(index, 0, e.target.value)
                        }
                      >
                        <option value="">노드 선택</option>
                        {upstreamNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {(n.data.title as string) || n.type}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Output Selection */}
                    <div className="flex-[3] relative">
                      <select
                        className={`w-full rounded border p-1.5 text-xs truncate ${
                          !selectedNodeId
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'border-gray-300 bg-white'
                        }`}
                        value={selectedVarKey}
                        onChange={(e) =>
                          handleSelectorUpdate(index, 1, e.target.value)
                        }
                        disabled={!selectedNodeId}
                      >
                        <option value="">
                          {!selectedNodeId ? '변수 선택' : '출력 선택'}
                        </option>
                        {availableOutputs.map((outKey) => (
                          <option key={outKey} value={outKey}>
                            {outKey}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
            {(data.referenced_variables || []).length === 0 && (
              <div className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-300 rounded">
                추가된 변수가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Prompts (Moved Down) */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <span className="text-sm font-semibold text-gray-700">프롬프트</span>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          {[
            {
              key: 'system_prompt',
              label: 'System Prompt',
              ref: systemPromptRef,
            },
            { key: 'user_prompt', label: 'User Prompt', ref: userPromptRef },
            {
              key: 'assistant_prompt',
              label: 'Assistant Prompt',
              ref: assistantPromptRef,
            },
          ].map(({ key, label, ref }) => (
            <div className="flex flex-col gap-1" key={key}>
              <label className="text-xs font-medium text-gray-700">
                {label}
              </label>
              <textarea
                ref={ref as any}
                value={(data as any)[key] || ''}
                onChange={(e) => handleFieldChange(key as any, e.target.value)}
                onKeyUp={(e) => handleKeyUp(e, key as any)}
                onClick={() => setShowSuggestions(false)}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 min-h-[80px]"
                placeholder={`${label}을 입력하세요. {{ 입력 시 변수 자동완성`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 자동완성 드롭다운 */}
      {showSuggestions && (
        <div
          className="fixed bg-white border border-gray-200 shadow-lg rounded z-50 w-48 max-h-40 overflow-y-auto"
          style={{
            top: suggestionPos.top,
            left: suggestionPos.left,
          }}
        >
          {(data.referenced_variables || []).length > 0 ? (
            (data.referenced_variables || []).map((v, i) => (
              <div
                key={i}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                onClick={() => insertVariable(v.name)}
              >
                {v.name || '(unnamed)'}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-400 italic">
              위에서 변수를 먼저 등록해주세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
