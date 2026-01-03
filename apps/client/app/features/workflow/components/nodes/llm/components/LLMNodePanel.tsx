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

export function LLMNodePanel({ nodeId, data }: LLMNodePanelProps) {
  const router = useRouter(); // Keeping router if it was used or remove if unused warning persists. Unused warning was present. I will remove it.
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activePromptField, setActivePromptField] = useState<
    'system_prompt' | 'user_prompt'
  >('user_prompt');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

  // Load Models State
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // 1. Upstream Nodes
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  // 2. Available Variables (flattened)
  const availableVariables = useMemo(
    () =>
      upstreamNodes.flatMap((n) => {
        const outputs = getNodeOutputs(n);
        return outputs.map((outputKey) => ({
          // id structure: "nodeId.outputKey"
          id: `${n.id}.${outputKey}`,
          // label: "NodeName > OutputKey"
          label: `${(n.data as { title?: string })?.title || n.type} > ${outputKey}`,
          // value to insert: "{{nodeId.outputKey}}"
          value: `{{${n.id}.${outputKey}}}`,
        }));
      }),
    [upstreamNodes],
  );

  // Handlers
  const handleUpdateData = useCallback(
    (key: keyof LLMNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  const handleUpdateParameters = useCallback(
    (key: string, value: unknown) => {
      // Need to merge with existing parameters.
      // data.parameters is Record<string, unknown>
      // but we can't access data inside useCallback dependency easily if we want latest?
      // Actually we have data in props.
      updateNodeData(nodeId, {
        parameters: {
          ...(data.parameters || {}),
          [key]: value,
        },
      });
    },
    [nodeId, data.parameters, updateNodeData],
  );

  const handleAddVariable = useCallback(() => {
    const currentVars = data.referenced_variables || [];
    updateNodeData(nodeId, {
      referenced_variables: [...currentVars, { name: '', value_selector: [] }],
    });
  }, [data.referenced_variables, nodeId, updateNodeData]);

  // Prompt Handlers
  const handleFieldChange = (
    field: 'system_prompt' | 'user_prompt',
    value: string,
  ) => {
    handleUpdateData(field, value);
  };

  const handleKeyUp = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    field: 'system_prompt' | 'user_prompt',
  ) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;

    setActivePromptField(field);

    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      const { top, left, height } = target.getBoundingClientRect();
      setSuggestionPos({
        top: top + height + window.scrollY,
        left: left + window.scrollX,
      });
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (varCode: string) => {
    const currentValue = data[activePromptField] || '';
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);
      // varCode includes {{...}} ? No, availableVariables.value includes {{...}}
      // Check logic. availableVariables.value = `{{${n.id}.${outputKey}}}`
      // We essentially want to replace the `{{` typed by user + whatever they typed, OR just append?
      // The logic `value.substring(selectionEnd - 2, selectionEnd) === '{{'` means user typed `{{`.
      // So we replace `{{` with `{{nodeId.key}}`? Or just append.
      // If user typed `{{`, we want `{{nodeId.key}}`.
      // The `varCode` comes from `availableVariables`.

      const newValue = `${prefix}${varCode}${suffix}`;

      handleFieldChange(activePromptField, newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varCode.length;
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
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/llm/models`,
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
            <div className="text-xs text-gray-400">Loading models...</div>
          ) : (
            <select
              className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              value={data.model_id || ''}
              onChange={(e) => handleUpdateData('model_id', e.target.value)}
            >
              <option value="" disabled>
                Select a model
              </option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.model_id_for_api_call}>
                  {model.name}{' '}
                  {model.provider_name ? `(${model.provider_name})` : ''}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Max Tokens</label>
            <input
              type="number"
              className="w-20 rounded border border-gray-300 p-1 text-sm focus:border-blue-500 focus:outline-none"
              value={(data.parameters?.max_tokens as number) || 2048}
              onChange={(e) =>
                handleUpdateParameters('max_tokens', parseInt(e.target.value))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Temperature</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="flex-1"
              value={(data.parameters?.temperature as number) || 0.7}
              onChange={(e) =>
                handleUpdateParameters(
                  'temperature',
                  parseFloat(e.target.value),
                )
              }
            />
            <span className="text-xs text-gray-500">
              {(data.parameters?.temperature as number) || 0.7}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* 2. Referenced Variables */}
      <CollapsibleSection
        title="Referenced Variables"
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddVariable();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Add Variable"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {(!data.referenced_variables ||
            data.referenced_variables.length === 0) && (
            <div className="text-xs text-gray-400 py-2 border border-dashed border-gray-200 rounded text-center">
              자동으로 프롬프트 변수가 감지됩니다.
            </div>
          )}
          {data.referenced_variables?.map((variable, index) => {
            const selectedSourceNodeId = variable.value_selector?.[0];
            return (
              <div
                key={index}
                className="flex flex-col gap-2 p-2 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                    placeholder="Variable Name"
                    value={variable.name}
                    onChange={(e) => {
                      const newVars = [...(data.referenced_variables || [])];
                      newVars[index] = {
                        ...newVars[index],
                        name: e.target.value,
                      };
                      handleUpdateData('referenced_variables', newVars);
                    }}
                  />
                  <button
                    onClick={() => {
                      const newVars = data.referenced_variables.filter(
                        (_, i) => i !== index,
                      );
                      handleUpdateData('referenced_variables', newVars);
                    }}
                    className="p-1 hover:bg-red-100 rounded text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {/* Source Selector */}
                <div className="flex gap-2">
                  <select
                    className="w-1/2 text-xs border border-gray-300 rounded px-2 py-1"
                    value={variable.value_selector?.[0] || ''}
                    onChange={(e) => {
                      const newVars = [...(data.referenced_variables || [])];
                      newVars[index] = {
                        ...newVars[index],
                        value_selector: [e.target.value, ''],
                      };
                      handleUpdateData('referenced_variables', newVars);
                    }}
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
                    onChange={(e) => {
                      const newVars = [...(data.referenced_variables || [])];
                      const currentNode = variable.value_selector?.[0] || '';
                      newVars[index] = {
                        ...newVars[index],
                        value_selector: [currentNode, e.target.value],
                      };
                      handleUpdateData('referenced_variables', newVars);
                    }}
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
              ref={textareaRef}
              className="w-full h-32 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="Explain {{topic}} in simple terms."
              value={data.user_prompt || ''}
              onChange={(e) => handleFieldChange('user_prompt', e.target.value)}
              onKeyUp={(e) => handleKeyUp(e, 'user_prompt')}
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
              {availableVariables.length > 0 ? (
                availableVariables.map((v) => (
                  <button
                    key={v.id}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    onClick={() => insertVariable(v.value)}
                  >
                    {v.label}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-400">
                  No variables found
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
