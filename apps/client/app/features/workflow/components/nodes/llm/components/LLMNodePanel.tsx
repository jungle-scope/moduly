import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { LLMNodeData } from '../../../../types/Nodes';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../../ui/CollapsibleSection';
import { Plus, Trash2 } from 'lucide-react';

// Backend Response Type matches LLMModelResponse
type ModelOption = {
  id: string; // UUID
  model_id_for_api_call: string; // "gpt-4o"
  name: string;
  type: string;
  provider_name?: string;
  is_active: boolean;
};

interface LLMNodePanelProps {
  nodeId: string;
  data: LLMNodeData;
}

// [NOTE] Get Caret Coordinates
const getCaretCoordinates = (
  element: HTMLTextAreaElement,
  position: number,
) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // Copy styles
  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';

  // 가장 간단하게:
  const textContent = element.value.substring(0, position);
  div.innerHTML =
    textContent.replace(/\n/g, '<br>') + '<span id="caret-marker">|</span>';

  document.body.appendChild(div);

  const marker = div.querySelector('#caret-marker');
  const coordinates = {
    top: marker
      ? marker.getBoundingClientRect().top - div.getBoundingClientRect().top
      : 0,
    left: marker
      ? marker.getBoundingClientRect().left - div.getBoundingClientRect().left
      : 0,
    height: parseInt(style.lineHeight) || 20,
  };

  document.body.removeChild(div);
  return coordinates;
};

export function LLMNodePanel({ nodeId, data }: LLMNodePanelProps) {
  const router = useRouter(); 
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);
  const userPromptRef = useRef<HTMLTextAreaElement>(null);
  const assistantPromptRef = useRef<HTMLTextAreaElement>(null);
  
  const [activePromptField, setActivePromptField] = useState<
    'system_prompt' | 'user_prompt' | 'assistant_prompt' | null
  >(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

  // Load Models State
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // 1. Upstream Nodes
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  // [VALIDATION] 등록되지 않은 변수 경고
  const validationErrors = useMemo(() => {
    const allPrompts = (data.system_prompt || '') + (data.user_prompt || '') + (data.assistant_prompt || '');
    // 등록된 변수 이름들 (공백 제거)
    const registeredNames = new Set((data.referenced_variables || []).map((v) => v.name?.trim()).filter(Boolean));
    const errors: string[] = [];

    // 정규식: 닫는 중괄호 } 를 제외한 모든 문자 1개 이상 (공백, 한글 포함)
    const regex = /{{\s*([^}]+?)\s*}}/g; 
    let match;
    while ((match = regex.exec(allPrompts)) !== null) {
      const varName = match[1].trim(); 
      // varName이 비어있지 않고, 등록된 이름에 없으면 에러
      if (varName && !registeredNames.has(varName)) {
        errors.push(varName);
      }
    }
    return Array.from(new Set(errors));
  }, [data.system_prompt, data.user_prompt, data.assistant_prompt, data.referenced_variables]);

  // Handlers
  const handleUpdateData = useCallback(
    (key: keyof LLMNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
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

  // Prompt Handlers (handleFieldChange already defined above, but we need handleKeyUp)
  const handleKeyUp = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    field: 'system_prompt' | 'user_prompt' | 'assistant_prompt',
  ) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;

    setActivePromptField(field);

    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      const coords = getCaretCoordinates(target, selectionEnd);
      
      setSuggestionPos({
        top: target.offsetTop + coords.top + coords.height, // Line height 아래
        left: target.offsetLeft + coords.left,
      });
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // insertVariable: varName을 삽입 (예: {{ topic }})
  const insertVariable = (varName: string) => {
    if (!activePromptField) return;

    const currentValue = (data as any)[activePromptField] || '';
    
    const refMap = {
      system_prompt: systemPromptRef,
      user_prompt: userPromptRef,
      assistant_prompt: assistantPromptRef,
    };
    const textarea = refMap[activePromptField]?.current;
    
    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);
      
      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      handleFieldChange(activePromptField, newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5; // {{ var }} 길이 보정
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  // Fetch Available Models for User
  useEffect(() => {
    const fetchMyModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/llm/my-models`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          },
        );
        if (res.ok) {
          const json = await res.json();
          setModelOptions(json);
        } else {
          console.error('Failed to fetch LLM models');
        }
      } catch (err) {
        console.error('Error fetching LLM models', err);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchMyModels();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* 1. Model Selection */}
      <CollapsibleSection title="Model">
        <div className="flex flex-col gap-2">
          {loadingModels ? (
            <div className="text-xs text-gray-400">모델 로딩 중...</div>
          ) : modelOptions.length > 0 ? (
            <select
              className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              value={data.model_id || ''}
              onChange={(e) => handleUpdateData('model_id', e.target.value)}
            >
              <option value="" disabled>
                모델을 선택하세요
              </option>
              {Object.entries(
                modelOptions
                  .filter((m) => {
                    const id = m.model_id_for_api_call.toLowerCase();
                    if (id.includes('embedding')) return false;
                    if (m.type === 'embedding') return false;
                    return true;
                  })
                  .reduce(
                    (acc, model) => {
                      const p = model.provider_name || 'Unknown';
                      if (!acc[p]) acc[p] = [];
                      acc[p].push(model);
                      return acc;
                    },
                    {} as Record<string, ModelOption[]>,
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
      </CollapsibleSection>

          {/* 2. Variables Mapping */}
          <CollapsibleSection
            title="Referenced Variables"
            icon={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddVariable();
                }}
                className="p-1 hover:bg-gray-200 rounded transition-colors ml-auto"
                title="Add Variable"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            }
          >
            <div className="flex flex-col gap-3">
              {(data.referenced_variables || []).length === 0 && (
                <div className="text-xs text-gray-400 p-2 text-center border border-dashed border-gray-200 rounded">
                  No variables defined. Click + to add.
                </div>
              )}
              {(data.referenced_variables || []).map((variable, index) => {
                const selectedSourceNodeId = variable.value_selector?.[0] || '';

                return (
                  <div
                    key={index}
                    className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">
                        Name
                      </span>
                      <input
                        className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                        placeholder="e.g. topic"
                        value={variable.name}
                        onChange={(e) =>
                          handleUpdateVariable(index, 'name', e.target.value)
                        }
                      />
                      <button
                        onClick={() => handleRemoveVariable(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 min-w-[32px]">
                        Value
                      </span>
                      <div className="flex-1 flex gap-1">
                        <select
                          className="w-1/2 text-xs border border-gray-300 rounded px-2 py-1"
                          value={selectedSourceNodeId}
                          onChange={(e) =>
                            handleSelectorUpdate(index, 0, e.target.value)
                          }
                        >
                          <option value="" disabled>
                            Select Node
                          </option>
                          {upstreamNodes.map((n) => (
                            <option key={n.id} value={n.id}>
                              {(n.data as { title?: string })?.title || n.type}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-1/2 text-xs border border-gray-300 rounded px-2 py-1"
                          value={variable.value_selector?.[1] || ''}
                          onChange={(e) =>
                            handleSelectorUpdate(index, 1, e.target.value)
                          }
                          disabled={!selectedSourceNodeId}
                        >
                          <option value="" disabled>
                            Select Output
                          </option>
                          {selectedSourceNodeId &&
                            getNodeOutputs(
                              nodes.find((n) => n.id === selectedSourceNodeId)!,
                            ).map((outKey) => (
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
            </div>
          </CollapsibleSection>

      {/* 3. Prompts */}
      <CollapsibleSection title="Prompts">
        <div className="flex flex-col gap-3 relative">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              System Prompt
            </label>
            <textarea
              ref={systemPromptRef}
              className="w-full h-24 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="You are a helpful assistant..."
              value={data.system_prompt || ''}
              onChange={(e) =>
                handleFieldChange('system_prompt', e.target.value)
              }
              onKeyUp={(e) => handleKeyUp(e, 'system_prompt')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              User Prompt
            </label>
            <textarea
              ref={userPromptRef}
              className="w-full h-32 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="Explain {{topic}} in simple terms."
              value={data.user_prompt || ''}
              onChange={(e) => handleFieldChange('user_prompt', e.target.value)}
              onKeyUp={(e) => handleKeyUp(e, 'user_prompt')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700">
              Assistant Prompt
            </label>
            <textarea
              ref={assistantPromptRef}
              className="w-full h-24 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="어시스턴트 응답 형식을 지정하세요..."
              value={data.assistant_prompt || ''}
              onChange={(e) =>
                handleFieldChange('assistant_prompt', e.target.value)
              }
              onKeyUp={(e) => handleKeyUp(e, 'assistant_prompt')}
            />
          </div>

          {showSuggestions && (
            <div
              className="absolute z-10 w-48 rounded border border-gray-200 bg-white shadow-lg"
              style={{
                top: suggestionPos.top,
                left: suggestionPos.left,
              }}
            >
              {(data.referenced_variables || []).length > 0 ? (
                (data.referenced_variables || []).map((v, i) => (
                  <button
                    key={i}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    onClick={() => insertVariable(v.name)}
                  >
                    {v.name || '(No Name)'}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-400">
                  No variables defined
                </div>
              )}
            </div>
          )}

          {/* [VALIDATION] 미등록 변수 경고 */}
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
              <p className="font-semibold mb-1">
                ⚠️ 등록되지 않은 변수가 감지되었습니다:
              </p>
              <ul className="list-disc list-inside">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] text-red-500">
                Referenced Variables 섹션에 변수를 등록해주세요.
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
