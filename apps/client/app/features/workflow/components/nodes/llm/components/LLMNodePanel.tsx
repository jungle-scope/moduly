import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { LLMNodeData } from '../../../../types/Nodes';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { HelpCircle, BookOpen, MousePointerClick } from 'lucide-react';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

// LLMModelResponse와 일치하는 백엔드 응답 타입
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

// [참고] 캐럿 좌표 가져오기
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

const isChatModelOption = (model: ModelOption) => {
  const id = model.model_id_for_api_call.toLowerCase();
  const name = model.name.toLowerCase();

  // 채팅용이 아닌 모델들 제외
  // 1. Embedding 모델
  if (id.includes('embedding') || model.type === 'embedding') return false;
  if (name.includes('embedding') || name.includes('임베딩')) return false;

  // 2. Audio/TTS/Whisper 모델
  if (id.includes('tts') || id.includes('whisper')) return false;
  if (id.includes('audio') || id.includes('transcribe')) return false;

  // 3. Image 생성 모델
  if (id.includes('dall-e') || id.includes('image')) return false;
  if (id.includes('imagen')) return false;

  // 4. Video 생성 모델
  if (id.includes('sora') || id.includes('veo')) return false;

  // 5. Realtime 모델 (실시간 음성 대화용)
  if (id.includes('realtime')) return false;

  // 6. Moderation/Search/특수 목적 모델
  if (id.includes('moderation')) return false;
  if (id.includes('search')) return false;
  if (id.includes('robotics') || id.includes('computer-use')) return false;
  if (id.includes('deep-research')) return false;

  // 7. 레거시 Completion 모델 (Chat이 아님)
  if (id.includes('davinci') || id.includes('babbage')) return false;
  if (id.includes('instruct') && !id.includes('gpt-3.5')) return false;

  // 8. 기타 특수 모델
  if (id.includes('aqa')) return false;
  if (id.includes('lyria')) return false;

  return true;
};

const groupModelsByProvider = (models: ModelOption[]) => {
  const sorted = [...models].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = sorted.reduce(
    (acc, model) => {
      const provider = model.provider_name || 'Unknown';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, ModelOption[]>,
  );

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, providerModels]) => ({
      provider,
      models: providerModels,
    }));
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

  // 모델 상태 로드
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const chatModelOptions = useMemo(
    () => modelOptions.filter(isChatModelOption),
    [modelOptions],
  );
  const groupedModelOptions = useMemo(
    () => groupModelsByProvider(chatModelOptions),
    [chatModelOptions],
  );
  const selectedModel = useMemo(
    () =>
      modelOptions.find(
        (model) => model.model_id_for_api_call === data.model_id,
      ),
    [modelOptions, data.model_id],
  );
  const fallbackCandidates = useMemo(
    () =>
      chatModelOptions.filter(
        (model) => model.model_id_for_api_call !== data.model_id,
      ),
    [chatModelOptions, data.model_id],
  );
  const groupedFallbackOptions = useMemo(
    () => {
      const groups = groupModelsByProvider(fallbackCandidates);
      if (!data.model_id) return groups;
      const selectedProvider = (
        selectedModel?.provider_name || 'Unknown'
      ).toLowerCase();
      return [...groups].sort((a, b) => {
        const aIsSelected = a.provider.toLowerCase() === selectedProvider;
        const bIsSelected = b.provider.toLowerCase() === selectedProvider;
        if (aIsSelected !== bIsSelected) {
          return aIsSelected ? 1 : -1;
        }
        return a.provider.localeCompare(b.provider);
      });
    },
    [fallbackCandidates, data.model_id, selectedModel],
  );
  const fallbackDisabled = !data.model_id?.trim();

  // 1. 상위 노드
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  // [VALIDATION] 등록되지 않은 변수 경고
  const validationErrors = useMemo(() => {
    const allPrompts =
      (data.system_prompt || '') +
      (data.user_prompt || '') +
      (data.assistant_prompt || '');
    // 등록된 변수 이름들 (공백 제거)
    const registeredNames = new Set(
      (data.referenced_variables || [])
        .map((v) => v.name?.trim())
        .filter(Boolean),
    );
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
  }, [
    data.system_prompt,
    data.user_prompt,
    data.assistant_prompt,
    data.referenced_variables,
  ]);

  // [VALIDATION] 불완전한 변수 경고 (이름은 있지만 selector가 불완전한 경우)
  const incompleteVariables = useMemo(() => {
    const incomplete: string[] = [];
    for (const v of data.referenced_variables || []) {
      const name = (v.name || '').trim();
      const selector = v.value_selector || [];
      // 이름은 있지만 selector가 불완전하면 경고
      if (name && (!selector || selector.length < 2 || !selector[1])) {
        incomplete.push(name);
      }
    }
    return incomplete;
  }, [data.referenced_variables]);

  // [VALIDATION] 모든 프롬프트가 비어있는지 확인
  const allPromptsEmpty = useMemo(() => {
    return (
      !data.system_prompt?.trim() &&
      !data.user_prompt?.trim() &&
      !data.assistant_prompt?.trim()
    );
  }, [data.system_prompt, data.user_prompt, data.assistant_prompt]);

  // 핸들러
  const handleUpdateData = useCallback(
    (key: keyof LLMNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  const handleModelChange = useCallback(
    (nextModelId: string) => {
      const updates: Partial<LLMNodeData> = { model_id: nextModelId };
      if (data.fallback_model_id && data.fallback_model_id === nextModelId) {
        updates.fallback_model_id = '';
      }
      updateNodeData(nodeId, updates);
    },
    [data.fallback_model_id, nodeId, updateNodeData],
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

  // 프롬프트 핸들러 (handleFieldChange는 위에 정의됨, handleKeyUp 필요)
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

  // 사용자가 사용 가능한 모델 가져오기
  useEffect(() => {
    const fetchMyModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch(`/api/v1/llm/my-models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
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
      {/* 1. 모델 선택 */}
      <CollapsibleSection title="Model">
        <div className="flex flex-col gap-2">
          {loadingModels ? (
            <div className="text-xs text-gray-400">모델 로딩 중...</div>
          ) : modelOptions.length > 0 ? (
            <>
              <select
                className="w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                value={data.model_id || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                size={1}
              >
                <option value="" disabled>
                  모델을 선택하세요
                </option>
                {groupedModelOptions.map(({ provider, models }) => (
                  <optgroup key={provider} label={provider.toUpperCase()}>
                    {models.map((m) => (
                      <option key={m.id} value={m.model_id_for_api_call}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Fallback Model
                  </label>
                  <div className="group relative inline-block">
                    <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                    <div className="absolute z-50 hidden group-hover:block w-60 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
                      기본 모델 호출이 실패하거나 타임아웃될 때 대신 사용할 모델입니다.
                      <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
                    </div>
                  </div>
                </div>
                <div className="relative group">
                  <select
                    className={`w-full rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none ${
                      fallbackDisabled
                        ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                        : ''
                    }`}
                    value={data.fallback_model_id || ''}
                    onChange={(e) =>
                      handleUpdateData('fallback_model_id', e.target.value)
                    }
                    disabled={fallbackDisabled}
                    size={1}
                  >
                    <option value="" disabled>
                      {fallbackDisabled
                        ? '먼저 모델을 선택하세요'
                        : 'Fallback 모델을 선택하세요'}
                    </option>
                    {groupedFallbackOptions.length > 0 ? (
                      groupedFallbackOptions.map(({ provider, models }) => (
                        <optgroup
                          key={provider}
                          label={provider.toUpperCase()}
                        >
                          {models.map((m) => (
                            <option
                              key={m.id}
                              value={m.model_id_for_api_call}
                            >
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    ) : fallbackDisabled ? null : (
                      <option value="" disabled>
                        선택 가능한 모델이 없습니다
                      </option>
                    )}
                  </select>
                  {fallbackDisabled && (
                    <div className="pointer-events-none absolute left-0 top-full z-10 mt-1 w-56 rounded border border-gray-200 bg-white p-2 text-[11px] text-gray-600 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                      먼저 기본 모델을 설정해주세요.
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Fallback 모델은 다른 Provider 사용을 권장합니다. 다른 Provider를
                  추가하려면 아래에서 API Key를 등록하세요.
                </p>
              </div>
              {/* Provider 설정 링크 */}
              <button
                onClick={() => router.push('/settings/provider')}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
              >
                Provider API Key 등록하기
              </button>
            </>
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

      {/* 2. 변수 매핑 */}
      <CollapsibleSection title="Referenced Variables">
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title="" // CollapsibleSection 내부에 타이틀이 있으므로 숨김
          description="프롬프트에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요."
        />
      </CollapsibleSection>

      {/* 2.5 참고 자료 버튼 (참고 자료 그룹 통합) */}
      <div className="my-2 group">
        <button
          type="button"
          onClick={() => {
            // 부모 컴포넌트에서 사이드 패널 열기
            const event = new CustomEvent('openLLMReferencePanel', {
              detail: { nodeId },
            });
            window.dispatchEvent(event);
          }}
          className={`relative w-full py-4 px-5 rounded-xl border-2 border-dashed transition-all duration-300 flex items-center gap-4 active:scale-[0.98] ${
            (data.knowledgeBases?.length ?? 0) > 0
              ? 'border-indigo-400 bg-indigo-50/80 text-indigo-800 shadow-sm hover:shadow-md hover:bg-indigo-50 hover:border-indigo-500'
              : 'border-gray-300 bg-gray-50/50 text-gray-600 hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-700 hover:shadow-sm'
          }`}
        >
          {/* 호버 시 배경 일러스트 효과 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

          {/* 왼쪽 아이콘 (책) */}
          <div
            className={`p-2 rounded-lg transition-colors duration-300 ${
              (data.knowledgeBases?.length ?? 0) > 0
                ? 'bg-indigo-200 text-indigo-700'
                : 'bg-gray-200 text-gray-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
            }`}
          >
            <BookOpen className="w-5 h-5" />
          </div>

          {/* 텍스트 내용 */}
          <div className="flex flex-col items-start flex-1 gap-0.5">
            <span className="font-bold text-sm tracking-tight">
              참고 자료 그룹 설정
            </span>
            <span
              className={`text-xs transition-colors duration-300 ${
                (data.knowledgeBases?.length ?? 0) > 0
                  ? 'text-indigo-600 font-medium'
                  : 'text-gray-400 group-hover:text-indigo-500'
              }`}
            >
              {(data.knowledgeBases?.length ?? 0) > 0
                ? `${data.knowledgeBases!.length}개 그룹 연결됨`
                : 'LLM에 지식을 연결하세요'}
            </span>
          </div>

          {/* 오른쪽 아이콘 (클릭 동작) */}
          <div className="transform transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-6deg] text-gray-300 group-hover:text-indigo-500">
            <MousePointerClick className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* 3. 프롬프트 */}
      <CollapsibleSection title="Prompts">
        <div className="flex flex-col gap-3 relative">
          {/* 프롬프트 설명 */}
          <p className="text-xs text-gray-500 mb-1">
            LLM에 전달할 메시지를 작성하세요. 최소 1개 이상 입력이 필요합니다.
          </p>

          {/* 모든 프롬프트가 비어있으면 경고 */}
          {allPromptsEmpty && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-700 text-xs">
              ⚠️ 최소 1개의 프롬프트를 입력해야 실행할 수 있습니다.
            </div>
          )}

          <div>
            <div className="flex items-center mb-1">
              <label className="text-xs font-semibold text-gray-700">
                System Prompt
              </label>
              <div className="group relative inline-block ml-1">
                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                <div className="absolute z-50 hidden group-hover:block w-48 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
                  AI의 역할, 성격, 행동 규칙을 정의합니다. 모든 대화에 일관되게
                  적용됩니다.
                  <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
                </div>
              </div>
            </div>
            <textarea
              ref={systemPromptRef}
              className="w-full h-24 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="예: 너는 친절하고 전문적인 고객 상담 AI입니다. 항상 존댓말을 사용하고, 정확하고 간결하게 답변해주세요."
              value={data.system_prompt || ''}
              onChange={(e) =>
                handleFieldChange('system_prompt', e.target.value)
              }
              onKeyUp={(e) => handleKeyUp(e, 'system_prompt')}
            />
          </div>

          <div>
            <div className="flex items-center mb-1">
              <label className="text-xs font-semibold text-gray-700">
                User Prompt
              </label>
              <div className="group relative inline-block ml-1">
                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                <div className="absolute z-50 hidden group-hover:block w-48 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
                  사용자가 AI에게 보내는 질문이나 요청입니다. {'{{ 변수명 }}'}{' '}
                  형식으로 동적 값을 삽입할 수 있습니다.
                  <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
                </div>
              </div>
            </div>
            <textarea
              ref={userPromptRef}
              className="w-full h-32 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder={`예: 다음 내용을 한국어로 3줄 요약해줘:\n\n{{ content }}`}
              value={data.user_prompt || ''}
              onChange={(e) => handleFieldChange('user_prompt', e.target.value)}
              onKeyUp={(e) => handleKeyUp(e, 'user_prompt')}
            />
          </div>

          <div>
            <div className="flex items-center mb-1">
              <label className="text-xs font-semibold text-gray-700">
                Assistant Prompt
              </label>
              <div className="group relative inline-block ml-1">
                <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                <div className="absolute z-50 hidden group-hover:block w-48 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
                  AI 응답의 시작 부분을 미리 지정합니다. 특정 형식이나 톤으로
                  응답을 유도할 때 유용합니다.
                  <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
                </div>
              </div>
            </div>
            <textarea
              ref={assistantPromptRef}
              className="w-full h-24 rounded border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none resize-y"
              placeholder="예: 분석 결과를 다음과 같이 정리하겠습니다:"
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
                  등록된 변수가 없습니다
                </div>
              )}
            </div>
          )}

          {/* [VALIDATION] 불완전한 변수 경고 */}
          {incompleteVariables.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-orange-700 text-xs">
              <p className="font-semibold mb-1">
                ⚠️ 변수의 노드/출력이 선택되지 않았습니다:
              </p>
              <ul className="list-disc list-inside">
                {incompleteVariables.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] text-orange-500">
                실행 시 빈 값으로 대체됩니다.
              </p>
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
