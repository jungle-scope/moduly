import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { GithubNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Plus } from 'lucide-react';

interface GithubNodePanelProps {
  nodeId: string;
  data: GithubNodeData;
}

export function GithubNodePanel({ nodeId, data }: GithubNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  // 상위 노드 가져오기
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleUpdateData = useCallback(
    (key: keyof GithubNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  // Variable handlers (LLM 노드와 동일)
  const handleAddVariable = useCallback(() => {
    handleUpdateData('referenced_variables', [
      ...(data.referenced_variables || []),
      { name: '', value_selector: [] },
    ]);
  }, [data.referenced_variables, handleUpdateData]);

  const handleRemoveVariable = useCallback(
    (index: number) => {
      const newVars = [...(data.referenced_variables || [])];
      newVars.splice(index, 1);
      handleUpdateData('referenced_variables', newVars);
    },
    [data.referenced_variables, handleUpdateData],
  );

  const handleUpdateVariable = useCallback(
    (index: number, field: 'name' | 'value_selector', value: any) => {
      const newVars = [...(data.referenced_variables || [])];
      newVars[index] = { ...newVars[index], [field]: value };
      handleUpdateData('referenced_variables', newVars);
    },
    [data.referenced_variables, handleUpdateData],
  );

  const handleSelectorUpdate = useCallback(
    (index: number, position: 0 | 1, value: string) => {
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
      handleUpdateData('referenced_variables', newVars);
    },
    [data.referenced_variables, handleUpdateData],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* 1. Action Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">Action</label>
        <select
          className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          value={data.action || 'get_pr'}
          onChange={(e) => handleUpdateData('action', e.target.value)}
        >
          <option value="get_pr">Get PR Diff</option>
          <option value="comment_pr">Comment on PR</option>
        </select>
      </div>

      {/* 2. Authentication */}
      <CollapsibleSection title="Authentication" defaultOpen={true}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">
            GitHub Personal Access Token
          </label>
          <input
            type="password"
            className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            placeholder="ghp_xxxxxxxxxxxx"
            value={data.api_token || ''}
            onChange={(e) => handleUpdateData('api_token', e.target.value)}
          />
        </div>
      </CollapsibleSection>

      {/* 3. Referenced Variables (LLM처럼) */}
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
          <p className="text-xs text-gray-500 mb-1">
            필드에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요.
          </p>

          {(data.referenced_variables || []).length === 0 && (
            <div className="text-xs text-gray-400 p-2 text-center border border-dashed border-gray-200 rounded">
              추가된 변수가 없습니다.
            </div>
          )}
          {(data.referenced_variables || []).map((variable, index) => {
            const selectedSourceNodeId = variable.value_selector?.[0] || '';
            const selectedVarKey = variable.value_selector?.[1] || '';

            const selectedNode = nodes.find(
              (n) => n.id === selectedSourceNodeId,
            );
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
                  {/* (1) Variable Name Input */}
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

                  {/* (2) Node Selection Dropdown */}
                  <div className="flex-[3]">
                    <select
                      className="w-full rounded border border-gray-300 p-1.5 text-xs truncate"
                      value={selectedSourceNodeId}
                      onChange={(e) =>
                        handleSelectorUpdate(index, 0, e.target.value)
                      }
                    >
                      <option value="">노드 선택</option>
                      {upstreamNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {(n.data as { title?: string })?.title || n.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* (3) Output Selection */}
                  <div className="flex-[3] relative">
                    <select
                      className={`w-full rounded border p-1.5 text-xs truncate ${
                        !selectedSourceNodeId
                          ? 'bg-gray-100 text-gray-400 border-gray-200'
                          : 'border-gray-300 bg-white'
                      }`}
                      value={selectedVarKey}
                      onChange={(e) =>
                        handleSelectorUpdate(index, 1, e.target.value)
                      }
                      disabled={!selectedSourceNodeId}
                    >
                      <option value="">
                        {!selectedSourceNodeId ? '변수 선택' : '출력 선택'}
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
        </div>
      </CollapsibleSection>

      {/* 3. Repository Info */}
      <CollapsibleSection title="Repository" defaultOpen={true}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Owner</label>
            <input
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="Ex) facebook"
              value={data.repo_owner || ''}
              onChange={(e) => handleUpdateData('repo_owner', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              Repository
            </label>
            <input
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="Ex) react"
              value={data.repo_name || ''}
              onChange={(e) => handleUpdateData('repo_name', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              PR Number
            </label>
            <input
              type="number"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="Ex) 123"
              value={data.pr_number || ''}
              onChange={(e) =>
                handleUpdateData('pr_number', parseInt(e.target.value) || 0)
              }
            />
            <p className="text-[10px] text-gray-400">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Comment Body (Only for comment_pr action) */}
      {data.action === 'comment_pr' && (
        <CollapsibleSection title="Comment Body" defaultOpen={true}>
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full h-32 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder="Enter comment text..."
              value={data.comment_body || ''}
              onChange={(e) => handleUpdateData('comment_body', e.target.value)}
            />
            <div className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
