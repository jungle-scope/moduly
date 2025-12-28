import { useCallback } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, Trash2 } from 'lucide-react';
import { HttpRequestNodeData, HttpMethod } from '../../../../types/Nodes';

interface HttpRequestNodePanelProps {
  nodeId: string;
  data: HttpRequestNodeData;
}

export function HttpRequestNodePanel({
  nodeId,
  data,
}: HttpRequestNodePanelProps) {
  const { updateNodeData, nodes } = useWorkflowStore();

  // Get available variables from other nodes
  const availableVariables = nodes
    .filter((n) => n.id !== nodeId)
    .flatMap((n) => {
      if (n.type === 'startNode') {
        const startData = n.data as any; // Using any to avoid circular type dependency issues for now
        return (startData.variables || []).map((v: any) => ({
          id: `${n.id}.${v.name}`,
          label: `${n.data.title || 'Start'} > ${v.label}`,
          value: `{{${n.id}.${v.name}}}`,
        }));
      }
      // Future: Add other node types here (e.g. LLMNode outputs)
      return [];
    });

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
    <div className="flex flex-col gap-6">
      {/* 1. Method & URL */}
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

      {/* 2. Headers */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">Headers</span>
          <button
            onClick={handleAddHeader}
            className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
            title="헤더 추가"
          >
            <Plus className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {data.headers?.map((header, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none font-mono placeholder:text-gray-400"
                placeholder="Key"
                value={header.key}
                onChange={(e) =>
                  handleUpdateHeader(index, 'key', e.target.value)
                }
              />
              <span className="text-gray-400">:</span>
              <input
                className="h-8 flex-1 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none font-mono placeholder:text-gray-400"
                placeholder="Value"
                value={header.value}
                onChange={(e) =>
                  handleUpdateHeader(index, 'value', e.target.value)
                }
              />
              <button
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                onClick={() => handleRemoveHeader(index)}
                title="삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {(!data.headers || data.headers.length === 0) && (
            <div className="text-center text-sm text-gray-400 py-2">
              설정된 헤더가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 3. Body (POST/PUT/PATCH only) */}
      {['POST', 'PUT', 'PATCH'].includes(data.method || '') && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-700">Body</label>
            <select
              className="h-7 rounded border border-gray-300 bg-gray-50 px-2 text-xs text-gray-500 shadow-sm focus:outline-none cursor-not-allowed"
              disabled
              value="json"
            >
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="relative">
            <textarea
              className="w-full h-40 rounded-lg border border-gray-300 p-3 text-sm font-mono shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              placeholder='{"key": "value"}'
              value={data.body || ''}
              onChange={(e) => handleUpdateData('body', e.target.value)}
            />
          </div>
          <p className="text-xs text-gray-500">
            JSON 형식으로 입력하거나 텍스트를 입력하세요.{' '}
            <code className="bg-gray-100 px-1 rounded">{`{{variable}}`}</code>{' '}
            문법으로 변수를 사용할 수 있습니다.
          </p>
        </div>
      )}

      {/* 4. Timeout */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">
          Timeout (ms)
        </label>
        <input
          type="number"
          className="h-9 w-full rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="5000"
          value={data.timeout || 5000}
          onChange={(e) =>
            handleUpdateData('timeout', parseInt(e.target.value) || 0)
          }
        />
      </div>

      {/* 5. Variable Helper */}
      {availableVariables.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-700">
              사용 가능한 변수
            </span>
            <p className="text-xs text-gray-500 mt-1">
              클릭하여 변수를 복사하세요.
            </p>
          </div>
          <div className="p-2 grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
            {availableVariables.map((v) => (
              <button
                key={v.id}
                className="flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-blue-50 rounded border border-transparent hover:border-blue-100 transition-colors group"
                onClick={() => {
                  navigator.clipboard.writeText(v.value);
                  // Optional: Show toast
                }}
                title="클릭하여 복사"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700">{v.label}</span>
                  <code className="text-gray-500 mt-0.5">{v.value}</code>
                </div>
                <span className="text-blue-500 opacity-0 group-hover:opacity-100 font-medium">
                  복사
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
