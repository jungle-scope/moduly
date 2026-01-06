import { useCallback, useMemo, useState, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { MailNodeData, EmailProvider } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { Plus } from 'lucide-react';

interface MailNodePanelProps {
  nodeId: string;
  data: MailNodeData;
}

// Provider별 IMAP 서버 프리셋
const PROVIDER_PRESETS: Record<
  Exclude<EmailProvider, 'custom'>,
  { imap_server: string; imap_port: number; use_ssl: boolean }
> = {
  gmail: {
    imap_server: 'imap.gmail.com',
    imap_port: 993,
    use_ssl: true,
  },
  naver: {
    imap_server: 'imap.naver.com',
    imap_port: 993,
    use_ssl: true,
  },
  daum: {
    imap_server: 'imap.daum.net',
    imap_port: 993,
    use_ssl: true,
  },
  outlook: {
    imap_server: 'outlook.office365.com',
    imap_port: 993,
    use_ssl: true,
  },
};

// Caret 좌표 계산 (자동완성용)
const getCaretCoordinates = (
  element: HTMLTextAreaElement,
  position: number,
) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';

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

export function MailNodePanel({ nodeId, data }: MailNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  const keywordRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

  // 상위 노드 가져오기
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleUpdateData = useCallback(
    (key: keyof MailNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  // Provider 변경 핸들러
  const handleProviderChange = useCallback(
    (provider: EmailProvider) => {
      handleUpdateData('provider', provider);

      // Custom이 아니면 프리셋 자동 설정
      if (provider !== 'custom') {
        const preset = PROVIDER_PRESETS[provider];
        handleUpdateData('imap_server', preset.imap_server);
        handleUpdateData('imap_port', preset.imap_port);
        handleUpdateData('use_ssl', preset.use_ssl);
      } else {
        // Custom 선택 시 예시 값 설정
        handleUpdateData('imap_server', 'imap.example.com');
        handleUpdateData('imap_port', 993);
        handleUpdateData('use_ssl', true);
      }
    },
    [handleUpdateData],
  );

  // 변수 핸들러
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

  // 자동완성 핸들러
  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;

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
    const currentValue = data.keyword || '';
    const textarea = keywordRef.current;

    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);

      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      handleUpdateData('keyword', newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const isCustomProvider = data.provider === 'custom';

  return (
    <div className="flex flex-col gap-2">
      {/* 1. Server Settings */}
      <CollapsibleSection title="Server Settings" defaultOpen={true}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              Provider
            </label>
            <select
              className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              value={data.provider || 'gmail'}
              onChange={(e) =>
                handleProviderChange(e.target.value as EmailProvider)
              }
            >
              <option value="gmail">Gmail</option>
              <option value="naver">Naver</option>
              <option value="daum">Daum</option>
              <option value="outlook">Outlook</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              IMAP Server
            </label>
            <input
              type="text"
              className={`h-8 w-full rounded border px-2 text-sm focus:outline-none ${
                isCustomProvider
                  ? 'border-gray-300 bg-white focus:border-blue-500'
                  : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
              }`}
              value={data.imap_server || ''}
              onChange={(e) => handleUpdateData('imap_server', e.target.value)}
              readOnly={!isCustomProvider}
              disabled={!isCustomProvider}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-gray-700">Port</label>
              <input
                type="number"
                className={`h-8 w-full rounded border px-2 text-sm focus:outline-none ${
                  isCustomProvider
                    ? 'border-gray-300 bg-white focus:border-blue-500'
                    : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                }`}
                value={data.imap_port || 993}
                onChange={(e) =>
                  handleUpdateData('imap_port', parseInt(e.target.value))
                }
                readOnly={!isCustomProvider}
                disabled={!isCustomProvider}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Use SSL
              </label>
              <input
                type="checkbox"
                className="h-8 w-8 rounded border border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                checked={data.use_ssl ?? true}
                onChange={(e) => handleUpdateData('use_ssl', e.target.checked)}
                disabled={!isCustomProvider}
              />
            </div>
          </div>

          {isCustomProvider ? (
            <p className="text-[10px] text-gray-500"></p>
          ) : (
            <p className="text-[10px] text-blue-600">
              ℹ️ Provider 선택 시 서버 설정이 자동으로 구성됩니다
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. Account */}
      <CollapsibleSection title="Account" defaultOpen={true}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Email</label>
            <input
              type="email"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
              value={data.email || ''}
              onChange={(e) => handleUpdateData('email', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="App password"
              value={data.password || ''}
              onChange={(e) => handleUpdateData('password', e.target.value)}
            />
            <p className="text-[10px] text-gray-500">
              💡 Gmail: 앱 비밀번호 사용 권장
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. Referenced Variables */}
      <CollapsibleSection title="Referenced Variables" defaultOpen={false}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              검색 조건에서 사용할 변수를 정의합니다
            </p>
            <button
              onClick={handleAddVariable}
              className="flex items-center gap-1 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>

          {(data.referenced_variables || []).map((variable, index) => {
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
                  <div className="flex-[2]">
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

                  {/* 출력 선택 */}
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
        </div>
      </CollapsibleSection>

      {/* 4. Search Options */}
      <CollapsibleSection title="Search Options" defaultOpen={true}>
        <div className="flex flex-col gap-2 relative">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Keyword</label>
            <textarea
              ref={keywordRef}
              className="w-full h-20 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder="Search keyword..."
              value={data.keyword || ''}
              onChange={(e) => handleUpdateData('keyword', e.target.value)}
              onKeyUp={handleKeyUp}
            />
            <p className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </p>
          </div>

          {/* 자동완성 suggestions */}
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Sender</label>
            <input
              type="text"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="sender@example.com"
              value={data.sender || ''}
              onChange={(e) => handleUpdateData('sender', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Subject</label>
            <input
              type="text"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Email subject..."
              value={data.subject || ''}
              onChange={(e) => handleUpdateData('subject', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                Start Date
              </label>
              <input
                type="date"
                className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
                value={data.start_date || ''}
                onChange={(e) => handleUpdateData('start_date', e.target.value)}
              />
              <p className="text-[10px] text-gray-500">
                💡 Default: 7 days ago
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                End Date
              </label>
              <input
                type="date"
                className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
                value={data.end_date || ''}
                onChange={(e) => handleUpdateData('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* Folder */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">Folder</label>
            <select
              className="h-8 rounded border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:border-blue-500"
              value={data.folder || 'INBOX'}
              onChange={(e) => handleUpdateData('folder', e.target.value)}
            >
              <option value="INBOX">INBOX</option>
              <option value="SENT">SENT</option>
              <option value="DRAFTS">DRAFTS</option>
              <option value="SPAM">SPAM</option>
              <option value="TRASH">TRASH</option>
            </select>
          </div>

          {/* Max Results */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              Max Results
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              value={data.max_results ?? ''}
              placeholder="5"
              onChange={(e) => {
                const value =
                  e.target.value === '' ? undefined : parseInt(e.target.value);
                handleUpdateData('max_results', value);
              }}
            />
            <p className="text-[10px] text-gray-500">
              💡 Default: 5 (if empty)
            </p>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="unread-only"
              className="h-4 w-4 rounded border-gray-300"
              checked={data.unread_only || false}
              onChange={(e) =>
                handleUpdateData('unread_only', e.target.checked)
              }
            />
            <label htmlFor="unread-only" className="text-xs text-gray-700">
              Unread only
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mark-as-read"
              className="h-4 w-4 rounded border-gray-300"
              checked={data.mark_as_read || false}
              onChange={(e) =>
                handleUpdateData('mark_as_read', e.target.checked)
              }
            />
            <label htmlFor="mark-as-read" className="text-xs text-gray-700">
              Mark as read after search
            </label>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
