import { useCallback, useMemo, useState, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { Plus, Trash2 } from 'lucide-react';
import {
  HttpRequestNodeData,
  HttpMethod,
  AuthType,
  HttpVariable,
} from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

// [참고] 캐럿 좌표 가져오기 (LLMNodePanel에서 복사됨)
const getCaretCoordinates = (
  element: HTMLTextAreaElement | HTMLInputElement,
  position: number,
) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // 스타일 복사
  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';

  // input 태그의 경우 스크롤과 줄바꿈 방지 처리 필요
  if (element.tagName === 'INPUT') {
    div.style.whiteSpace = 'nowrap';
    div.style.overflow = 'hidden';
  }

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

interface HttpRequestNodePanelProps {
  nodeId: string;
  data: HttpRequestNodeData;
}

export function HttpRequestNodePanel({
  nodeId,
  data,
}: HttpRequestNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  // 자동완성을 위한 Refs
  const urlRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // 자동완성 상태
  const [activeField, setActiveField] = useState<'url' | 'body' | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

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

  // 변수 핸들러
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

  // 자동완성 핸들러
  const handleKeyUp = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: 'url' | 'body',
  ) => {
    const target = e.target as HTMLTextAreaElement | HTMLInputElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd || 0;

    setActiveField(field);

    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      const coords = getCaretCoordinates(target, selectionEnd);

      setSuggestionPos({
        top: target.offsetTop + coords.top + coords.height,
        left: target.offsetLeft + coords.left,
      });
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (varName: string) => {
    if (!activeField) return;

    const currentValue = (data as any)[activeField] || '';
    const ref = activeField === 'url' ? urlRef : bodyRef;
    const input = ref.current;

    if (!input) return;

    const selectionEnd = input.selectionEnd || 0;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);

      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      handleUpdateData(activeField, newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5;
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  return (
    <div className="flex flex-col gap-2 relative">
      {/* 1. 메서드 & URL */}
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
          ref={urlRef}
          className="h-9 flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          placeholder="https://api.example.com/v1/resource"
          value={data.url || ''}
          onChange={(e) => handleUpdateData('url', e.target.value)}
          onKeyUp={(e) => handleKeyUp(e, 'url')}
          autoComplete="off"
        />
      </div>

      {/* 2. 참조된 변수 */}
      <CollapsibleSection title="Referenced Variables" defaultOpen={true} showDivider>
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title=""
        />
      </CollapsibleSection>
      <CollapsibleSection title="Authentication" showDivider>
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

      {/* 3. 헤더 */}
      <CollapsibleSection
        title="Headers"
        showDivider
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

      {/* 4. 본문 (POST/PUT/PATCH 전용) */}
      {['POST', 'PUT', 'PATCH'].includes(data.method || '') && (
        <CollapsibleSection title="Body" showDivider>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Content-Type: JSON</span>
            </div>
            <textarea
              ref={bodyRef}
              className="w-full h-32 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder='{"key": "value"}'
              value={data.body || ''}
              onChange={(e) => handleUpdateData('body', e.target.value)}
              onKeyUp={(e) => handleKeyUp(e, 'body')}
            />
            <div className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* 5. 설정 (타임아웃) */}
      <CollapsibleSection title="Settings" defaultOpen={false} showDivider>
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

      {/* 자동완성 제안 드롭다운 */}
      {showSuggestions && (
        <div
          className="absolute z-50 w-48 rounded border border-gray-200 bg-white shadow-lg"
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
    </div>
  );
}
