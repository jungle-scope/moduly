import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { HttpVariable, SlackPostNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

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

interface SlackPostNodePanelProps {
  nodeId: string;
  data: SlackPostNodeData;
}

export function SlackPostNodePanel({ nodeId, data }: SlackPostNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  const mode = data.slackMode || 'webhook';
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const blocksRef = useRef<HTMLTextAreaElement>(null);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [activeField, setActiveField] = useState<'message' | 'blocks' | null>(
    null,
  );

  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const handleUpdateData = useCallback(
    (key: keyof SlackPostNodeData, value: unknown) => {
      updateNodeData(nodeId, { [key]: value });
    },
    [nodeId, updateNodeData],
  );

  // 기본값 보정 (method, mode)
  useEffect(() => {
    if (data.method !== 'POST') {
      updateNodeData(nodeId, { method: 'POST' });
    }
    if (!data.slackMode) {
      updateNodeData(nodeId, { slackMode: 'webhook' });
    }
  }, [data.method, data.slackMode, nodeId, updateNodeData]);

  const payloadInfo = useMemo(() => {
    const payload: Record<string, any> = {
      text: data.message || '',
    };
    const warnings: string[] = [];

    if (mode === 'api' && data.channel?.trim()) {
      payload.channel = data.channel.trim();
    }

    if (data.blocks?.trim()) {
      try {
        payload.blocks = JSON.parse(data.blocks);
      } catch {
        warnings.push('블록 JSON을 해석할 수 없어 제외했습니다.');
      }
    }

    return {
      preview: JSON.stringify(payload, null, 2),
      warnings,
    };
  }, [data.message, data.blocks, data.channel, mode]);

  const availableVariables = useMemo(
    () =>
      (data.referenced_variables || [])
        .map((v) => (v.name || '').trim())
        .filter(Boolean),
    [data.referenced_variables],
  );

  const missingVariables = useMemo(() => {
    const regex = /{{\s*([^}]+?)\s*}}/g;
    const combined = (data.message || '') + (data.blocks || '');
    const missing = new Set<string>();
    let match;
    while ((match = regex.exec(combined)) !== null) {
      const varName = match[1].trim();
      if (varName && !availableVariables.includes(varName)) {
        missing.add(varName);
      }
    }
    return Array.from(missing);
  }, [data.message, data.blocks, availableVariables]);

  const trimmedUrl = (data.url || '').trim();
  const blocksText = (data.blocks || '').trim();
  const blocksJsonError = useMemo(() => {
    if (!blocksText) return false;
    try {
      JSON.parse(blocksText);
      return false;
    } catch {
      return true;
    }
  }, [blocksText]);

  const isWebhookUrlValid = useMemo(() => {
    if (mode !== 'webhook') return true;
    return (
      trimmedUrl.startsWith('https://hooks.slack.com/') &&
      trimmedUrl.includes('/services/')
    );
  }, [mode, trimmedUrl]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const hasMessage = !!data.message?.trim();
    const hasValidBlocks = !!blocksText && !blocksJsonError;

    if (mode === 'webhook') {
      if (!trimmedUrl) {
        issues.push('Web Hook URL이 필요합니다.');
      } else if (!isWebhookUrlValid) {
        issues.push('Web Hook URL 형식이 올바르지 않습니다.');
      }
    } else {
      if (!trimmedUrl) {
        issues.push('Slack API 엔드포인트가 필요합니다.');
      }
      if (!data.authConfig?.token?.trim()) {
        issues.push('봇 토큰이 필요합니다.');
      }
      if (!data.channel?.trim()) {
        issues.push('채널 ID가 필요합니다.');
      }
    }

    if (!hasMessage && !hasValidBlocks) {
      issues.push('메시지 또는 유효한 블록 JSON이 필요합니다.');
    }

    if (blocksJsonError) {
      issues.push('블록 JSON이 유효하지 않습니다.');
    }

    if (missingVariables.length > 0) {
      issues.push('등록되지 않은 입력변수가 있습니다.');
    }

    return issues;
  }, [
    mode,
    trimmedUrl,
    data.message,
    data.authConfig?.token,
    data.channel,
    blocksText,
    blocksJsonError,
    isWebhookUrlValid,
    missingVariables.length,
  ]);

  // Slack 전용 필드로 구성된 payload를 HTTP body에 자동 반영
  useEffect(() => {
    if (payloadInfo.preview !== data.body) {
      updateNodeData(nodeId, { body: payloadInfo.preview });
    }
  }, [payloadInfo.preview, data.body, nodeId, updateNodeData]);

  // 헤더 핸들러
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

  // 참조 변수 핸들러
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

  const handleModeChange = useCallback(
    (nextMode: 'webhook' | 'api') => {
      if (nextMode === mode) return;
      if (nextMode === 'webhook') {
        updateNodeData(nodeId, {
          slackMode: 'webhook',
          url: '',
          authType: 'none',
          authConfig: {},
        });
      } else {
        updateNodeData(nodeId, {
          slackMode: 'api',
          url: 'https://slack.com/api/chat.postMessage',
          authType: 'bearer',
          authConfig: { token: data.authConfig?.token || '' },
        });
      }
    },
    [mode, updateNodeData, nodeId, data.authConfig],
  );

  const insertVariable = useCallback(
    (varName: string) => {
      const textarea =
        activeField === 'blocks' ? blocksRef.current : messageRef.current;
      if (!textarea) return;

      const selectionEnd = textarea.selectionEnd;
      const value = textarea.value;

      // 가장 가까운 "{{"를 찾아 그 위치를 기준으로 치환
      const lastOpen = value.lastIndexOf('{{', selectionEnd);
      const prefix =
        lastOpen !== -1
          ? value.substring(0, lastOpen)
          : value.substring(0, selectionEnd);
      const suffix = value.substring(selectionEnd);
      const newValue = `${prefix}{{ ${varName} }}${suffix}`;

      if (activeField === 'blocks') {
        handleUpdateData('blocks', newValue);
      } else {
        handleUpdateData('message', newValue);
      }
      setShowSuggestions(false);

      requestAnimationFrame(() => {
        const newCursorPos = prefix.length + varName.length + 5;
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [activeField, handleUpdateData],
  );

  const handleTemplateKeyUp = useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      field: 'message' | 'blocks',
    ) => {
      const target = e.target as HTMLTextAreaElement;
      const value = target.value;
      const selectionEnd = target.selectionEnd;

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
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {validationIssues.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
          <p className="font-semibold mb-1">⚠️ 실행을 위해 확인이 필요합니다:</p>
          <ul className="list-disc list-inside">
            {validationIssues.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-700">전송 방식</label>
        <div className="bg-gray-100 p-1 rounded-lg inline-flex w-full gap-1">
          <button
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              mode === 'api'
                ? 'bg-white shadow-sm text-[#4A154B] font-semibold'
                : 'text-gray-700 hover:bg-white/70'
            }`}
            onClick={() => handleModeChange('api')}
            type="button"
          >
            Slack API
          </button>
          <button
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              mode === 'webhook'
                ? 'bg-white shadow-sm text-[#4A154B] font-semibold'
                : 'text-gray-700 hover:bg-white/70'
            }`}
            onClick={() => handleModeChange('webhook')}
            type="button"
          >
            Web Hook
          </button>
        </div>
        <p className="text-[11px] text-gray-600">
          Web Hook 또는 API 모드를 고르고, URL/토큰을 붙여넣으면 요청이 자동
          구성됩니다.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-700">
          {mode === 'api' ? 'Slack API 엔드포인트' : 'Web Hook URL'}
        </label>
        <div className="flex gap-2 items-center">
          <span className="px-2 py-1 rounded-md bg-[#4A154B]/10 text-[#4A154B] text-[11px] font-bold">
            POST
          </span>
          <input
            className="h-9 flex-1 rounded-md border border-gray-300 px-3 py-1 text-sm shadow-sm focus:border-[#4A154B] focus:outline-none focus:ring-1 focus:ring-[#4A154B] font-mono"
            placeholder={
              mode === 'api'
                ? 'https://slack.com/api/chat.postMessage'
                : 'https://hooks.slack.com'
            }
            value={data.url || ''}
            onChange={(e) => handleUpdateData('url', e.target.value)}
          />
        </div>
        {mode === 'webhook' ? (
          <div className="space-y-1 text-[10px] text-gray-500">
            <p>
              Incoming Webhook URL만 붙여넣으면 됩니다. URL 자체가 시크릿입니다.
            </p>
            <a
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white text-[#4A154B] border border-[#4A154B]/40 text-xs font-semibold hover:bg-[#4A154B]/10 transition-colors"
              href="https://api.slack.com/messaging/webhooks"
              target="_blank"
              rel="noreferrer"
            >
              🔗 Slack Webhook 발급 가이드
            </a>
            <div className="mt-2 border-b border-gray-200" />
          </div>
        ) : (
          <p className="text-[10px] text-gray-500">
            chat.postMessage 기본값입니다. 필요하면 다른 Slack API로 변경하세요.
          </p>
        )}
      </div>

      {mode === 'api' && (
        <>
          <div className="border-b border-gray-200" />
          <CollapsibleSection title="Slack API 인증" defaultOpen showDivider>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-gray-700">
                봇 토큰 (Bearer)
              </label>
              <input
                type="password"
                className="h-9 w-full rounded border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:border-[#4A154B]"
                placeholder="xoxb-..."
                value={data.authConfig?.token || ''}
                onChange={(e) =>
                  updateNodeData(nodeId, {
                    authType: 'bearer',
                    authConfig: { ...data.authConfig, token: e.target.value },
                  })
                }
              />
              <a
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white text-[#4A154B] border border-[#4A154B]/40 text-xs font-semibold hover:bg-[#4A154B]/10 transition-colors w-fit"
                href="https://api.slack.com/authentication/token-types#bot"
                target="_blank"
                rel="noreferrer"
              >
                🔗 Slack 봇 토큰 발급 가이드
              </a>

              <label className="text-xs font-medium text-gray-700">
                채널 ID
              </label>
              <input
                className="h-9 w-full rounded border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:border-[#4A154B]"
                placeholder="C0123456789 (채널 ID)"
                value={data.channel || ''}
                onChange={(e) => handleUpdateData('channel', e.target.value)}
              />
              <p className="text-[10px] text-gray-500">
                공개/비공개 채널 ID를 입력하세요. # 없이 ID 형태로 넣는 것이
                안전합니다.
              </p>
            </div>
          </CollapsibleSection>
        </>
      )}

      <CollapsibleSection
        title="헤더 / 타임아웃"
        showDivider
        icon={
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddHeader();
            }}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="헤더 추가"
          >
            <Plus className="w-3.5 h-3.5 text-gray-600" />
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[10px] text-gray-500">
            기본 <code>Content-Type: application/json</code> 이 자동 적용됩니다.
            추가로 필요한 헤더만 입력하세요.
          </p>
          <div className="flex flex-col gap-2">
            {data.headers?.map((header, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  className="h-8 w-1/3 rounded border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:border-[#4A154B]"
                  placeholder="키"
                  value={header.key}
                  onChange={(e) =>
                    handleUpdateHeader(index, 'key', e.target.value)
                  }
                />
                <input
                  className="h-8 flex-1 rounded border border-gray-300 px-2 text-xs font-mono focus:outline-none focus:border-[#4A154B]"
                  placeholder="값"
                  value={header.value}
                  onChange={(e) =>
                    handleUpdateHeader(index, 'value', e.target.value)
                  }
                />
                <button
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  onClick={() => handleRemoveHeader(index)}
                  title="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {(!data.headers || data.headers.length === 0) && (
              <div className="text-center text-xs text-gray-400 py-2 border border-dashed border-gray-200 rounded">
                기본 Content-Type: application/json 이 자동 적용됩니다.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-gray-700">
                타임아웃 (ms)
              </label>
              <div className="group relative inline-block">
                <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                <div className="absolute z-50 hidden group-hover:block w-56 p-2 text-[11px] text-gray-600 bg-white border border-gray-200 rounded-lg shadow-lg left-0 top-5">
                  요청이 이 시간 내에 끝나지 않으면 자동으로 실패 처리됩니다.
                  <div className="absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
                </div>
              </div>
            </div>
            <input
              type="number"
              className="h-8 w-full rounded border border-gray-300 px-2 text-sm focus:outline-none focus:border-[#4A154B]"
              placeholder="5000"
              value={data.timeout || 5000}
              onChange={(e) =>
                handleUpdateData('timeout', parseInt(e.target.value) || 0)
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="입력변수" showDivider>
        <ReferencedVariablesControl
          variables={data.referenced_variables || []}
          upstreamNodes={upstreamNodes}
          onUpdate={handleUpdateVariable}
          onAdd={handleAddVariable}
          onRemove={handleRemoveVariable}
          title=""
          description="메시지/블록에서 사용할 입력변수를 정의하고, 이전 노드의 출력값과 연결하세요."
        />
      </CollapsibleSection>

      <CollapsibleSection title="메시지" defaultOpen={true} showDivider>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="relative">
              <textarea
                ref={messageRef}
                className="w-full h-24 rounded border border-gray-300 p-2 text-sm shadow-sm focus:border-[#4A154B] focus:outline-none focus:ring-1 focus:ring-[#4A154B] resize-y"
                placeholder="예) :tada: 새 알림이 도착했어요! {{ 변수명 }} 로 치환 가능"
                value={data.message || ''}
                onChange={(e) => handleUpdateData('message', e.target.value)}
                onKeyUp={(e) => handleTemplateKeyUp(e, 'message')}
              />
              {showSuggestions &&
                availableVariables.length > 0 &&
                activeField === 'message' && (
                  <div
                    className="absolute z-20 bg-white border border-gray-200 rounded shadow-md text-xs py-1"
                    style={{ top: suggestionPos.top, left: suggestionPos.left }}
                  >
                    {availableVariables.map((name) => (
                      <button
                        key={name}
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => insertVariable(name)}
                        type="button"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
            </div>
            {missingVariables.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
                <p className="font-semibold mb-1">⚠️ 등록되지 않은 입력변수:</p>
                <ul className="list-disc list-inside">
                  {missingVariables.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-red-500">
                  입력변수에 추가하거나 템플릿에서 제거하세요.
                </p>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="블록 (선택)" defaultOpen={false} showDivider>
        <div className="flex flex-col gap-3">
          <div className="rounded border border-dashed border-[#4A154B]/30 bg-[#4A154B]/5 p-3 text-[11px] text-gray-700 space-y-2">
            <div className="font-semibold text-[#4A154B] flex items-center gap-2">
              <span aria-hidden>🎯</span>
              <span>Slack 고급 메시지 구성 (선택 사항)</span>
            </div>
            <p>
              Block Kit Builder에서 메시지를 설계한 뒤, 생성된 JSON을 아래에
              붙여넣어 주세요.
            </p>
            <a
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white text-[#4A154B] border border-[#4A154B]/40 text-xs font-semibold hover:bg-[#4A154B]/10 transition-colors"
              href="https://app.slack.com/block-kit-builder"
              target="_blank"
              rel="noreferrer"
            >
              🔗 Block Kit Builder 열기
            </a>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              블록(JSON)
            </label>
            <div className="relative">
              <textarea
                ref={blocksRef}
                className="w-full h-28 rounded border border-gray-300 p-2 text-xs font-mono shadow-sm focus:border-[#4A154B] focus:outline-none focus:ring-1 focus:ring-[#4A154B] resize-y"
                placeholder='[ { "type": "section", "text": { "type": "mrkdwn", "text": "*Hello*" } } ]'
                value={data.blocks || ''}
                onChange={(e) => handleUpdateData('blocks', e.target.value)}
                onKeyUp={(e) => handleTemplateKeyUp(e, 'blocks')}
              />
              {showSuggestions &&
                availableVariables.length > 0 &&
                activeField === 'blocks' && (
                  <div
                    className="absolute z-20 bg-white border border-gray-200 rounded shadow-md text-xs py-1"
                    style={{ top: suggestionPos.top, left: suggestionPos.left }}
                  >
                    {availableVariables.map((name) => (
                      <button
                        key={name}
                        className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                        onClick={() => insertVariable(name)}
                        type="button"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
          <p className="text-[10px] text-gray-500">
            JSON이 유효하지 않으면 페이로드에서 제외되고 경고가 표시됩니다.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="페이로드 미리보기 (HTTP 본문)"
        defaultOpen
        showDivider
      >
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full h-32 rounded border border-gray-300 p-2 text-xs font-mono shadow-sm bg-gray-50"
            readOnly
            value={payloadInfo.preview}
            spellCheck={false}
          />
          {payloadInfo.warnings.length > 0 && (
            <div className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded p-2">
              {payloadInfo.warnings.map((warning, idx) => (
                <div key={idx}>• {warning}</div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-500">
            이 영역은 옵션이 아니라, 실제로 전송될 HTTP 본문을 미리 보여주는
            용도입니다.
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}
