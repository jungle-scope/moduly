import { useCallback, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, Trash2 } from 'lucide-react';
import {
  HttpRequestNodeData,
  HttpMethod,
  AuthType,
} from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../../ui/CollapsibleSection';

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

  // 모든 상위 노드에서 사용 가능한 변수 가져오기
  const availableVariables = useMemo(
    () =>
      upstreamNodes.flatMap((n) => {
        const outputs = getNodeOutputs(n);
        return outputs.map((outputKey) => ({
          id: `${n.id}.${outputKey}`,
          label: `${(n.data as { title?: string })?.title || n.type} > ${outputKey}`,
          value: `{{${n.id}.${outputKey}}}`,
        }));
      }),
    [upstreamNodes],
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

      {/* 2. Authentication */}
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

      {/* 6. Variable Helper */}
      {availableVariables.length > 0 && (
        <CollapsibleSection title="Available Variables" defaultOpen={false}>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
            {availableVariables.map((v) => (
              <button
                key={v.id}
                className="flex items-center justify-between px-2 py-1.5 text-xs text-left hover:bg-gray-100 rounded border border-transparent hover:border-gray-200 transition-colors group"
                onClick={() => {
                  navigator.clipboard.writeText(v.value);
                }}
                title="Click to copy"
              >
                <div className="flex flex-col truncate">
                  <span className="font-medium text-gray-700 truncate">
                    {v.label}
                  </span>
                  <code className="text-gray-500 text-[10px] mt-0.5">
                    {v.value}
                  </code>
                </div>
                <span className="text-blue-500 text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap ml-2">
                  Copy
                </span>
              </button>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
