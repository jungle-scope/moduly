import { useMemo, useState } from 'react';
import { LLMNodeData } from '../../../../types/Nodes';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

interface LLMNodePanelProps {
  nodeId: string;
  data: LLMNodeData;
}

export function LLMNodePanel({ nodeId, data }: LLMNodePanelProps) {
  // NOTE: [LLM] 기존 StartNodePanel 패턴을 따라간 LLM 설정 패널
  const { updateNodeData, nodes } = useWorkflowStore();
  const [referencedInput, setReferencedInput] = useState('');

  const availableContextVars = useMemo(() => {
    // Start 노드 변수명을 옵션으로 활용 (추후 이전 노드 output으로 대체 예정)
    return nodes
      .filter((n) => n.type === 'startNode')
      .flatMap((n: any) => n.data?.variables || [])
      .map((v: any) => v.name)
      .filter(Boolean);
  }, [nodes]);

  const handleFieldChange = (field: keyof LLMNodeData, value: any) => {
    updateNodeData(nodeId, { [field]: value });
  };

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

  return (
    <div className="flex flex-col gap-4">
      {/* Provider / Model */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">모델 설정</span>
        </div>
        <div className="px-4 py-3 bg-white flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Provider</label>
            <input
              type="text"
              value={data.provider || ''}
              onChange={(e) => handleFieldChange('provider', e.target.value)}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="예: openai"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Model ID</label>
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
