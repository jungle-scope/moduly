import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, Trash2 } from 'lucide-react';
import {
  HttpRequestNodeData,
  HttpMethod,
  AuthType,
  HttpVariable,
} from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';

interface HttpRequestNodePanelProps {
  nodeId: string;
  data: HttpRequestNodeData;
}

export function HttpRequestNodePanel({
  nodeId,
  data,
}: HttpRequestNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  // 상위 노드 가져오기
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleUpdateData = useCallback(
    (key: keyof HttpRequestNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  const handleAddHeader = useCallback(() => {
    const newHeaders = [...(data.headers || []), { key: '', value: '' }];
    updateNodeData(nodeId, { headers: newHeaders });
  }, [data.headers, nodeId, updateNodeData]);

  const handleRemoveHeader = useCallback(
    (index: number) => {
      const newHeaders = [...(data.headers || [])];
      newHeaders.splice(index, 1);
      updateNodeData(nodeId, { headers: newHeaders });
    },
    [data.headers, nodeId, updateNodeData],
  );

  const handleUpdateHeader = useCallback(
    (index: number, key: 'key' | 'value', value: string) => {
      const newHeaders = [...(data.headers || [])];
      newHeaders[index] = { ...newHeaders[index], [key]: value };
      updateNodeData(nodeId, { headers: newHeaders });
    },
    [data.headers, nodeId, updateNodeData],
  );

  // Variable Handlers
  const handleAddVariable = useCallback(() => {
    const newVars = [
      ...(data.referenced_variables || []),
      { name: '', value_selector: [] },
    ];
    updateNodeData(nodeId, { referenced_variables: newVars });
  }, [data.referenced_variables, nodeId, updateNodeData]);

  const handleRemoveVariable = useCallback(
    (index: number) => {
      const newVars = [...(data.referenced_variables || [])];
      newVars.splice(index, 1);
      updateNodeData(nodeId, { referenced_variables: newVars });
    },
    [data.referenced_variables, nodeId, updateNodeData],
  );

  const handleUpdateVariable = useCallback(
    (index: number, key: keyof HttpVariable, value: any) => {
      const newVars = [...(data.referenced_variables || [])];
      newVars[index] = { ...newVars[index], [key]: value };
      updateNodeData(nodeId, { referenced_variables: newVars });
    },
    [data.referenced_variables, nodeId, updateNodeData],
  );

  const handleSelectorUpdate = useCallback(
    (varIndex: number, selectorIndex: number, value: string) => {
      const newVars = [...(data.referenced_variables || [])];
      const newSelector = [...(newVars[varIndex].value_selector || [])];
      newSelector[selectorIndex] = value;
      // If changing node (index 0), reset output key (index 1)
      if (selectorIndex === 0) {
        newSelector[1] = '';
      }
      newVars[varIndex] = { ...newVars[varIndex], value_selector: newSelector };
      updateNodeData(nodeId, { referenced_variables: newVars });
    },
    [data.referenced_variables, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* 1. Method & URL */}
      {/* 이 부분은 항상 보여야 하므로 Collapsible에서 제외하거나 별도 섹션으로 둘 수 있음.
          가장 중요한 정보이므로 상단에 노출. */}
      <div className="flex gap-2">
        <select
          className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium w-24"
          value={data.method || 'GET'}
          onChange={(e) =>
            handleUpdateData('method', e.target.value as HttpMethod)
          }
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        <input
          className="h-9 flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          placeholder="https://api.example.com/v1/resource"
          value={data.url || ''}
          onChange={(e) => handleUpdateData('url', e.target.value)}
        />
      </div>

      {/* 2. Referenced Variables */}
      <CollapsibleSection title="Referenced Variables" defaultOpen={true}>
        <div className="flex flex-col gap-2">
          {data.referenced_variables?.map((variable, index) => {
            const selectedSourceNodeId = variable.value_selector?.[0] || '';
            const selectedVarKey = variable.value_selector?.[1] || '';

            const selectedNode = upstreamNodes.find(
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
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    Variable {index + 1}
                  </span>
                  <button
                    onClick={() => handleRemoveVariable(index)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex flex-row gap-2 items-center">
                  {/* 변수명 입력 */}
                  <div className="flex-2">
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 p-1.5 text-xs"
                      placeholder="Variable name"
                      value={variable.name}
                      onChange={(e) =>
                        handleUpdateVariable(index, 'name', e.target.value)
                      }
                    />
                  </div>

                  {/* 노드 선택 드롭다운 */}
                  <div className="flex-3">
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

                  {/* 출력 선택 */}
                  <div className="flex-3 relative">
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
                      <option value="">출력 선택</option>
                      {availableOutputs.map((output) => (
                        <option key={output} value={output}>
                          {output}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <button
              onClick={handleAddVariable}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-3 h-3" /> Add Variable
            </button>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Authentication">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <select
              className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
              value={data.authType || 'none'}
              onChange={(e) =>
                handleUpdateData('authType', e.target.value as AuthType)
              }
            >
              <option value="none">No Authentication</option>
              <option value="bearer">Bearer Token</option>
              <option value="apiKey">API Key</option>
            </select>
          </div>

          {data.authType === 'bearer' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Token</label>
              <input
                className="w-full h-8 rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                placeholder="Ex) eyJhbGciOiJIUzI1Ni..."
                value={data.authConfig?.token || ''}
                onChange={(e) =>
                  handleUpdateData('authConfig', {
                    ...data.authConfig,
                    token: e.target.value,
                  })
                }
              />
              <p className="text-[10px] text-gray-400">
                Authorization: Bearer {'{token}'}
              </p>
            </div>
          )}

          {data.authType === 'apiKey' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">
                  Header Name
                </label>
                <input
                  className="w-full h-8 rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                  placeholder="Ex) X-API-Key"
                  value={data.authConfig?.apiKeyHeader || 'X-API-Key'}
                  onChange={(e) =>
                    handleUpdateData('authConfig', {
                      ...data.authConfig,
                      apiKeyHeader: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-700">
                  API Key
                </label>
                <input
                  className="w-full h-8 rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                  placeholder="Ex) my-secret-key-123"
                  value={data.authConfig?.apiKeyValue || ''}
                  onChange={(e) =>
                    handleUpdateData('authConfig', {
                      ...data.authConfig,
                      apiKeyValue: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 3. Headers */}
      <CollapsibleSection
        title="Headers"
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddHeader();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Add Header"
          >
            <Plus className="w-3.5 h-3.5 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-2">
          {data.headers?.map((header, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                className="h-8 w-1/3 rounded border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                placeholder="Key"
                value={header.key}
                onChange={(e) =>
                  handleUpdateHeader(index, 'key', e.target.value)
                }
              />
              <input
                className="h-8 flex-1 rounded border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:border-blue-500"
                placeholder="Value"
                value={header.value}
                onChange={(e) =>
                  handleUpdateHeader(index, 'value', e.target.value)
                }
              />
              <button
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                onClick={() => handleRemoveHeader(index)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {(!data.headers || data.headers.length === 0) && (
            <div className="text-center text-xs text-gray-400 py-2 border border-dashed border-gray-200 rounded">
              No headers
            </div>
          )}

          <div className="text-[10px] text-blue-600 bg-blue-50 p-2 rounded">
            Header 미입력 시, Body가 있으면 자동 <code>application/json</code>{' '}
            추가됨.
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. Body (POST/PUT/PATCH only) */}
      {['POST', 'PUT', 'PATCH'].includes(data.method || '') && (
        <CollapsibleSection title="Body">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Content-Type: JSON</span>
            </div>
            <textarea
              className="w-full h-32 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder='{"key": "value"}'
              value={data.body || ''}
              onChange={(e) => handleUpdateData('body', e.target.value)}
            />
            <div className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 5. Settings (Timeout) */}
      <CollapsibleSection title="Settings" defaultOpen={false}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700">
            Timeout (ms)
          </label>
          <input
            type="number"
            className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
            placeholder="5000"
            value={data.timeout || 5000}
            onChange={(e) =>
              handleUpdateData('timeout', parseInt(e.target.value) || 0)
            }
          />
        </div>
      </CollapsibleSection>
    </div>
  );
}
