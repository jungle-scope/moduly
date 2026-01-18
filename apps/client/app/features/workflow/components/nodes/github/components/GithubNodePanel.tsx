import { useCallback, useMemo, useState, useRef } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { GithubNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getIncompleteVariables } from '../../../../utils/validationUtils';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';
import { RoundedSelect } from '../../../ui/RoundedSelect';
import { ExternalLink } from 'lucide-react';
import { IncompleteVariablesAlert } from '../../../ui/IncompleteVariablesAlert';
import { ValidationAlert } from '../../../ui/ValidationAlert';

interface GithubNodePanelProps {
  nodeId: string;
  data: GithubNodeData;
}

// 노드 실행 필수 요건 체크
// 1. API 토큰이 입력되어야 함
// 2. 소유자(Owner)가 입력되어야 함
// 3. 저장소(Repo) 이름이 입력되어야 함
// 4. PR 번호가 유효해야 함 (양수)

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

export function GithubNodePanel({ nodeId, data }: GithubNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();

  const commentBodyRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });

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

  const tokenMissing = useMemo(() => {
    return !data.api_token?.trim();
  }, [data.api_token]);

  const ownerMissing = useMemo(() => {
    return !data.repo_owner?.trim();
  }, [data.repo_owner]);

  const repoMissing = useMemo(() => {
    return !data.repo_name?.trim();
  }, [data.repo_name]);

  const prMissing = useMemo(() => {
    return !data.pr_number || data.pr_number <= 0;
  }, [data.pr_number]);

  const incompleteVariables = useMemo(
    () => getIncompleteVariables(data.referenced_variables),
    [data.referenced_variables],
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
    const currentValue = data.comment_body || '';
    const textarea = commentBodyRef.current;

    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);

    if (lastOpen !== -1) {
      const prefix = currentValue.substring(0, lastOpen);
      const suffix = currentValue.substring(selectionEnd);

      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      handleUpdateData('comment_body', newValue);
      setShowSuggestions(false);

      setTimeout(() => {
        const newCursorPos = prefix.length + varName.length + 5;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 1. 액션 선택 */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">작업</label>
        <RoundedSelect
          value={data.action || 'get_pr'}
          onChange={(val) => {
            const newAction = val;
            handleUpdateData('action', newAction);

            // Action에 따라 title 자동 변경
            const titleMap: Record<string, string> = {
              get_pr: 'Get PR Diff',
              comment_pr: 'Comment on PR',
            };
            handleUpdateData('title', titleMap[newAction] || 'GitHub');
          }}
          options={[
            { label: 'Get PR Diff', value: 'get_pr' },
            { label: 'Comment on PR', value: 'comment_pr' },
          ]}
        />
      </div>
      <div className="border-b border-gray-200" />

      {/* 2. 인증 */}
      <CollapsibleSection title="인증" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-gray-700">
            GitHub 개인 액세스 토큰
          </label>
          <input
            type="password"
            className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            placeholder="ghp_xxxxxxxxxxxx"
            value={data.api_token || ''}
            onChange={(e) => handleUpdateData('api_token', e.target.value)}
          />
          <a
            href="https://github.com/settings/tokens/new?description=Moduly&scopes=repo"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors w-fit"
          >
            <ExternalLink className="w-3 h-3" />
            GitHub 토큰 발급받기 (repo 권한 포함)
          </a>
          {tokenMissing && (
            <ValidationAlert message="⚠️ API 토큰을 입력해주세요." />
          )}
        </div>
      </CollapsibleSection>

      {/* 3. 참조 변수 (LLM과 유사) */}
      <CollapsibleSection title="입력변수" showDivider>
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title="" // 내부 타이틀 숨김
          description="이 섹션에서 입력변수를 등록하고, 이전 노드의 출력값과 연결하세요."
        />

        <IncompleteVariablesAlert variables={incompleteVariables} />
      </CollapsibleSection>

      {/* 3. 저장소 정보 */}
      <CollapsibleSection title="저장소 정보" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">소유자</label>
            <input
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="예) facebook"
              value={data.repo_owner || ''}
              onChange={(e) => handleUpdateData('repo_owner', e.target.value)}
            />
            {ownerMissing && (
              <ValidationAlert message="⚠️ 소유자를 입력해주세요." />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">저장소</label>
            <input
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="예) react"
              value={data.repo_name || ''}
              onChange={(e) => handleUpdateData('repo_name', e.target.value)}
            />
            {repoMissing && (
              <ValidationAlert message="⚠️ 저장소 이름을 입력해주세요." />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">PR 번호</label>
            <input
              type="number"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm font-mono focus:outline-none focus:border-blue-500"
              placeholder="예) 123"
              value={data.pr_number || ''}
              onChange={(e) =>
                handleUpdateData('pr_number', parseInt(e.target.value) || 0)
              }
            />
            <p className="text-[10px] text-gray-400">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
            </p>
            {prMissing && (
              <ValidationAlert message="⚠️ PR 번호를 입력해주세요." />
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. 코멘트 내용 (PR 코멘트 액션 전용) */}
      {data.action === 'comment_pr' && (
        <CollapsibleSection title="코멘트 내용" defaultOpen={true} showDivider>
          <div className="flex flex-col gap-2 relative">
            <textarea
              ref={commentBodyRef}
              className="w-full h-32 rounded border border-gray-300 p-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
              placeholder="코멘트 내용을 입력하세요..."
              value={data.comment_body || ''}
              onChange={(e) => handleUpdateData('comment_body', e.target.value)}
              onKeyUp={handleKeyUp}
            />
            <div className="text-[10px] text-gray-500">
              💡 <code>{'{{variable}}'}</code> 문법 사용 가능
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
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
