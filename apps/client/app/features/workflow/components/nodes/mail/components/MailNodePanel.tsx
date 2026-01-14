import { useCallback, useMemo, useState, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { MailNodeData, EmailProvider } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getIncompleteVariables } from '../../../../utils/validationUtils';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';
import { AlertTriangle } from 'lucide-react';
import { ValidationAlert } from '../../../ui/ValidationAlert';
import { IncompleteVariablesAlert } from '../../../ui/IncompleteVariablesAlert';

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

  // [VALIDATION] 이메일 필수 체크
  const emailMissing = useMemo(() => {
    return !data.email?.trim();
  }, [data.email]);

  // [VALIDATION] 비밀번호 필수 체크
  const passwordMissing = useMemo(() => {
    return !data.password?.trim();
  }, [data.password]);

  // [VALIDATION] 불완전한 변수 (이름은 있지만 selector가 불완전한 경우)
  const incompleteVariables = useMemo(
    () => getIncompleteVariables(data.referenced_variables),
    [data.referenced_variables]
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
      {/* 1. 서버 설정 */}
      <CollapsibleSection title="서버 설정" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              메일 서비스
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
              <option value="custom">직접 설정</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              IMAP 서버
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
              <label className="text-xs font-medium text-gray-700">포트</label>
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
                SSL 사용
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
              ℹ️ 메일 서비스 선택 시 서버 설정이 자동으로 구성됩니다
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. 계정 */}
      <CollapsibleSection title="계정" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">이메일</label>
            <input
              type="email"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
              value={data.email || ''}
              onChange={(e) => handleUpdateData('email', e.target.value)}
            />
            {emailMissing && (
              <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs mt-1">
                <p className="font-semibold flex items-center gap-1">
                  ⚠️ 이메일을 입력해주세요.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              비밀번호
            </label>
            <input
              type="password"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="앱 비밀번호"
              value={data.password || ''}
              onChange={(e) => handleUpdateData('password', e.target.value)}
            />
            <p className="text-[10px] text-gray-500">
              💡 Gmail: 앱 비밀번호 사용 권장
            </p>
            {passwordMissing && (
              <ValidationAlert message="⚠️ 비밀번호를 입력해주세요." />
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. 참조 변수 */}
      <CollapsibleSection title="입력변수" defaultOpen={false} showDivider>
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title=""
          description="검색 조건에서 사용할 입력변수를 등록하고, 이전 노드의 출력값과 연결하세요."
        />

        {/* [VALIDATION] 불완전한 변수 경고 */}
        <IncompleteVariablesAlert variables={incompleteVariables} />
      </CollapsibleSection>

      {/* 4. 검색 옵션 */}
      <CollapsibleSection title="검색 옵션" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-2 relative">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              검색 키워드
            </label>
            <textarea
              ref={keywordRef}
              className="w-full h-20 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder="검색 키워드를 입력하세요..."
              value={data.keyword || ''}
              onChange={(e) => handleUpdateData('keyword', e.target.value)}
              onKeyUp={handleKeyUp}
            />
            <p className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </p>
          </div>

          {/* 자동완성 제안 */}
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
                    {v.name || '(이름 없음)'}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-gray-400">
                  등록된 입력변수가 없습니다.
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">보낸 사람</label>
            <input
              type="text"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="예) sender@example.com"
              value={data.sender || ''}
              onChange={(e) => handleUpdateData('sender', e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">제목</label>
            <input
              type="text"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="메일 제목..."
              value={data.subject || ''}
              onChange={(e) => handleUpdateData('subject', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                시작 날짜
              </label>
              <input
                type="date"
                className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
                value={data.start_date || ''}
                onChange={(e) => handleUpdateData('start_date', e.target.value)}
              />
              <p className="text-[10px] text-gray-500">
                💡 기본값: 7일 전
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                종료 날짜
              </label>
              <input
                type="date"
                className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-blue-500"
                value={data.end_date || ''}
                onChange={(e) => handleUpdateData('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* 폴더 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">폴더</label>
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

          {/* 최대 결과 수 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              최대 결과 수
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
              💡 기본값: 5 (비어있을 때)
            </p>
          </div>

          {/* 체크박스 */}
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
              읽지 않은 메일만
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
              검색 후 읽음 처리
            </label>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
}
