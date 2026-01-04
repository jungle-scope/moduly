import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  knowledgeApi,
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { KnowledgeNodeData } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';

// LLM 노드와 동일한 caret 좌표 계산 헬퍼
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

interface KnowledgeNodePanelProps {
  nodeId: string;
  data: KnowledgeNodeData;
}

export const KnowledgeNodePanel: React.FC<KnowledgeNodePanelProps> = ({
  nodeId,
  data,
}) => {
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseResponse[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<
    Record<string, KnowledgeBaseDetailResponse>
  >({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [detailError, setDetailError] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const selectedIds = useMemo(
    () => new Set((data.knowledgeBases || []).map((kb) => kb.id)),
    [data.knowledgeBases],
  );
  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );
  const scoreThreshold = data.scoreThreshold ?? 0.5;
  const topK = data.topK ?? 3;
  const recommendedScoreRange: [number, number] = [0.3, 0.6];
  const recommendedTopKRange: [number, number] = [3, 8];
  const queryInputRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const suggestionItems = useMemo(
    () =>
      Array.from(
        new Set(
          (data.queryVariables || [])
            .map((v) => v.name?.trim())
            .filter(Boolean) as string[],
        ),
      ),
    [data.queryVariables],
  );
  const missingVariables = useMemo(() => {
    const names = new Set(
      (data.queryVariables || [])
        .map((v) => v.name?.trim())
        .filter(Boolean) as string[],
    );
    const placeholders: string[] = [];
    const regex = /\{\{\s*([^}]+?)\s*\}\}/g;
    const query = data.userQuery || '';
    let match: RegExpExecArray | null;
    while ((match = regex.exec(query)) !== null) {
      const varName = match[1].trim();
      if (varName && !names.has(varName)) {
        placeholders.push(varName);
      }
    }
    return Array.from(new Set(placeholders));
  }, [data.queryVariables, data.userQuery]);

  const topKIndicator = useMemo(() => {
    const max = 20;
    const clamped = Math.min(max, Math.max(1, topK));
    return (clamped / max) * 100;
  }, [topK]);

  useEffect(() => {
    const fetchBases = async () => {
      setLoading(true);
      setError(null);
      try {
        const bases = await knowledgeApi.getKnowledgeBases();
        setKnowledgeBases(bases);
      } catch (err) {
        console.error('Failed to load knowledge bases', err);
        setError('지식 베이스를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchBases();
  }, []);

  const toggleKnowledgeBase = (kb: KnowledgeBaseResponse) => {
    const current = data.knowledgeBases || [];
    let next = current;
    if (selectedIds.has(kb.id)) {
      next = current.filter((item) => item.id !== kb.id);
    } else {
      next = [...current, { id: kb.id, name: kb.name }];
    }
    updateNodeData(nodeId, { knowledgeBases: next });
  };

  const selectedCount = selectedIds.size;

  const handleToggleExpand = async (kb: KnowledgeBaseResponse) => {
    const nextExpanded = new Set(expandedIds);
    if (nextExpanded.has(kb.id)) {
      nextExpanded.delete(kb.id);
      setExpandedIds(nextExpanded);
      return;
    }

    // Expand
    nextExpanded.add(kb.id);
    setExpandedIds(nextExpanded);

    // Fetch detail if not cached
    if (!details[kb.id]) {
      setDetailLoading((prev) => ({ ...prev, [kb.id]: true }));
      setDetailError((prev) => ({ ...prev, [kb.id]: '' }));
      try {
        const detail = await knowledgeApi.getKnowledgeBase(kb.id);
        setDetails((prev) => ({ ...prev, [kb.id]: detail }));
      } catch (err) {
        console.error('Failed to load knowledge base detail', err);
        setDetailError((prev) => ({
          ...prev,
          [kb.id]: '문서 목록을 불러오지 못했습니다.',
        }));
      } finally {
        setDetailLoading((prev) => ({ ...prev, [kb.id]: false }));
      }
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const insertVariableAtCursor = (variableName: string) => {
    const textarea = queryInputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const insertText = `{{ ${variableName} }}`;
    const nextValue = before + insertText + after;

    updateNodeData(nodeId, { userQuery: nextValue });

    // 커서 위치 갱신
    const caretPos = before.length + insertText.length;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(caretPos, caretPos);
    });
    setShowSuggestions(false);
  };

  const handleAddQueryVariable = () => {
    const current = data.queryVariables || [];
    updateNodeData(nodeId, {
      queryVariables: [...current, { name: '', value_selector: [] }],
    });
  };

  const handleRemoveQueryVariable = (index: number) => {
    const current = data.queryVariables || [];
    const next = current.filter((_, i) => i !== index);
    updateNodeData(nodeId, { queryVariables: next });
  };

  const handleUpdateQueryVarName = (index: number, value: string) => {
    const current = data.queryVariables || [];
    const next = [...current];
    next[index] = { ...next[index], name: value };
    updateNodeData(nodeId, { queryVariables: next });
  };

  const handleQuerySelectorUpdate = (
    index: number,
    position: 0 | 1,
    value: string,
  ) => {
    const current = data.queryVariables || [];
    const next = [...current];
    const selector = [...(next[index].value_selector || [])];

    if (selector.length < 2) {
      selector[0] = selector[0] || '';
      selector[1] = selector[1] || '';
    }

    selector[position] = value;
    if (position === 0) {
      selector[1] = '';
    }

    next[index] = { ...next[index], value_selector: selector };
    updateNodeData(nodeId, { queryVariables: next });
  };

  const handleQueryKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const selectionEnd = target.selectionEnd || 0;
    const value = target.value;

    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
      const coords = getCaretCoordinates(target, selectionEnd);
      setSuggestionPos({
        top: target.offsetTop + coords.top + coords.height,
        left: target.offsetLeft + coords.left,
      });
      setShowSuggestions(true);
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <CollapsibleSection title="지식 베이스 선택">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            노드가 참조할 지식 베이스를 하나 이상 선택하세요.
          </p>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                필수
              </span>
              <span>
                선택됨:{' '}
                <span className="font-medium text-gray-800">
                  {selectedCount}
                </span>
              </span>
            </span>
            {loading && <span className="text-indigo-600">불러오는 중...</span>}
            {error && <span className="text-red-500">{error}</span>}
          </div>

          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {knowledgeBases.map((kb) => {
              const isSelected = selectedIds.has(kb.id);
              const isExpanded = expandedIds.has(kb.id);
              const kbDetail = details[kb.id];
              const kbDetailLoading = detailLoading[kb.id];
              const kbDetailError = detailError[kb.id];
              const completedDocs =
                kbDetail?.documents?.filter(
                  (doc) => doc.status === 'completed',
                ) || [];
              return (
                <label
                  key={kb.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors w-full ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleKnowledgeBase(kb)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-start gap-2 w-full min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="text-sm font-semibold text-gray-900 truncate"
                          title={kb.name}
                        >
                          {kb.name}
                        </span>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
                          {formatDate(kb.created_at)} · {kb.document_count}건
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleExpand(kb);
                        }}
                        className="ml-auto text-[11px] text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 whitespace-nowrap flex-shrink-0 self-start"
                      >
                        {isExpanded ? '목록 숨기기' : '목록 보기'}
                      </button>
                    </div>
                    {kb.description && (
                      <span className="text-xs text-gray-600 leading-snug">
                        {kb.description}
                      </span>
                    )}
                    {isExpanded && (
                      <div className="mt-2 rounded border border-gray-200 bg-white">
                        <div className="px-3 py-1.5 flex items-center justify-between text-xs text-gray-700 border-b border-gray-100">
                          <span>지식 목록</span>
                          {kbDetailLoading && (
                            <span className="text-indigo-600">
                              불러오는 중...
                            </span>
                          )}
                          {kbDetailError && (
                            <span className="text-red-500">
                              {kbDetailError}
                            </span>
                          )}
                        </div>
                        <div className="max-h-24 overflow-y-auto divide-y divide-gray-100">
                          {completedDocs.length ? (
                            completedDocs.slice(0, 3).map((doc, index) => (
                              <div
                                key={doc.id || `${kb.id}-doc-${index}`}
                                className="px-3 py-1.5 text-sm text-gray-900 flex items-center gap-2 min-w-0 w-full"
                              >
                                <span
                                  className="truncate flex-1 min-w-0"
                                  title={doc.filename}
                                >
                                  {doc.filename}
                                </span>
                                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                                  청크 {doc.chunk_count ?? 0}개
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-3 text-xs text-gray-500">
                              완료된 지식이 없습니다.
                            </div>
                          )}
                        </div>
                        {completedDocs.length > 3 && (
                          <div className="px-3 py-1 text-[11px] text-gray-500 border-t border-gray-100 bg-gray-50">
                            스크롤로 추가 지식을 확인하세요.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}

            {!loading && !knowledgeBases.length && !error && (
              <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                등록된 지식 베이스가 없습니다. 먼저 지식 베이스를 생성해주세요.
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="검색 설정">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">
            검색 품질을 조정할 수 있습니다.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-gray-700">
              <span>Score Threshold</span>
              <span className="text-xs text-gray-500">
                {scoreThreshold.toFixed(2)}
              </span>
            </div>
            <div className="relative h-7">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-gray-100 ring-1 ring-gray-200 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-y-0 bg-indigo-300/80"
                  style={{
                    left: `${recommendedScoreRange[0] * 100}%`,
                    right: `${(1 - recommendedScoreRange[1]) * 100}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-indigo-600"
                  style={{ left: `${scoreThreshold * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={scoreThreshold}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNodeData(nodeId, {
                    scoreThreshold: Number.isNaN(value) ? undefined : value,
                  });
                }}
                className="absolute inset-0 w-full h-6 bg-transparent accent-indigo-600 appearance-none
                [&::-webkit-slider-runnable-track]:bg-transparent
                [&::-moz-range-track]:bg-transparent
                [&::-ms-track]:bg-transparent"
                style={{ background: 'transparent' }}
              />
            </div>
            <span className="text-[11px] text-gray-500">
              유사도 점수 하한선입니다. 값이 높을수록 더 엄격하게 필터링합니다
              (0~1).
            </span>
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>
                권장: {recommendedScoreRange[0]} ~ {recommendedScoreRange[1]}
              </span>
              <span>현재: {scoreThreshold.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm font-medium text-gray-700">
              <span>Top K</span>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={topK}
              onChange={(e) => {
                const value = Number(e.target.value);
                updateNodeData(nodeId, {
                  topK: Number.isNaN(value)
                    ? undefined
                    : Math.min(20, Math.max(1, Math.floor(value))),
                });
              }}
              className="h-9 rounded border border-gray-300 px-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-500">
              검색 시 반환할 컨텍스트 개수입니다. 필요한 맥락만 가져오도록 1~20
              사이에서 설정하세요 (기본 3).
            </span>
            <div className="relative h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-indigo-200"
                style={{
                  left: `${(recommendedTopKRange[0] / 20) * 100}%`,
                  right: `${(1 - recommendedTopKRange[1] / 20) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-indigo-600"
                style={{ left: `${topKIndicator}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>
                권장: {recommendedTopKRange[0]} ~ {recommendedTopKRange[1]}
              </span>
              <span>현재: {topK}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="변수 매핑">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              상위 노드의 출력을 입력 쿼리에 매핑하세요.
            </span>
            <button
              type="button"
              onClick={handleAddQueryVariable}
              className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              + 변수 추가
            </button>
          </div>

          {missingVariables.length === 0 &&
            (data.queryVariables || []).some(
              (v) =>
                !v.name?.trim() &&
                (!(v.value_selector || [])[0] ||
                  (v.value_selector || []).length < 1),
            ) && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                비어 있는 변수 행이 있습니다. 이름과 값을 입력하거나 행을
                삭제하세요.
              </div>
            )}

          <div className="flex flex-col gap-2">
            {(data.queryVariables || []).map((variable, index) => {
              const [selectedNodeId, selectedVarKey] =
                variable.value_selector || ['', ''];
              const selectedNode = nodes.find((n) => n.id === selectedNodeId);
              const availableOutputs = selectedNode
                ? getNodeOutputs(selectedNode as any)
                : [];

              return (
                <div
                  key={index}
                  className="rounded border border-gray-200 bg-white p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) =>
                        handleUpdateQueryVarName(index, e.target.value)
                      }
                      placeholder="쿼리에서 사용할 변수명"
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveQueryVariable(index)}
                      className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <select
                      className="w-1/2 rounded border border-gray-300 p-2 text-sm truncate focus:border-indigo-500 focus:outline-none"
                      value={selectedNodeId || ''}
                      onChange={(e) =>
                        handleQuerySelectorUpdate(
                          index,
                          0,
                          e.target.value || '',
                        )
                      }
                    >
                      <option value="">노드 선택</option>
                      {upstreamNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {(n.data.title as string) || n.type}
                        </option>
                      ))}
                    </select>

                    <select
                      className={`w-1/2 rounded border p-2 text-sm truncate focus:border-indigo-500 focus:outline-none ${
                        selectedNodeId
                          ? 'border-gray-300 bg-white'
                          : 'border-gray-200 bg-gray-100 text-gray-400'
                      }`}
                      value={selectedVarKey || ''}
                      onChange={(e) =>
                        handleQuerySelectorUpdate(
                          index,
                          1,
                          e.target.value || '',
                        )
                      }
                      disabled={!selectedNodeId}
                    >
                      <option value="">
                        {!selectedNodeId
                          ? '먼저 노드를 선택하세요'
                          : '변수 선택'}
                      </option>
                      {availableOutputs.map((outKey) => (
                        <option key={outKey} value={outKey}>
                          {outKey}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}

            {(data.queryVariables || []).length === 0 && (
              <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                필요한 경우 입력 변수와 상위 노드 출력을 연결해 입력 쿼리를
                구성하세요.
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="입력 쿼리">
        <div className="flex flex-col gap-2 relative">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              필수
            </span>
          </label>
          <textarea
            ref={queryInputRef}
            value={data.userQuery || ''}
            onChange={(e) =>
              updateNodeData(nodeId, { userQuery: e.target.value })
            }
            onKeyUp={handleQueryKeyUp}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            className="w-full rounded border border-gray-300 p-2 text-sm focus:border-indigo-500 focus:outline-none min-h-[80px] resize-y"
            placeholder="질의를 입력하거나 변수로 구성하세요. '{{' 입력 시 변수 목록이 나타납니다."
          />
          <span className="text-[11px] text-gray-500">
            비어 있으면 검색이 실행되지 않습니다. 필요한 경우 매핑한 변수를 함께
            사용하세요.
          </span>
          {missingVariables.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
              <div>
                등록되지 않은 변수:{' '}
                <strong className="font-bold">
                  {missingVariables.join(', ')}
                </strong>
              </div>
              <div className="text-[11px] text-red-700 mt-1">
                변수 매핑 섹션에서 추가하거나 쿼리에서 제거하세요.
              </div>
            </div>
          )}

          {showSuggestions && suggestionItems.length > 0 && (
            <div
              className="absolute z-50 w-56 rounded border border-gray-200 bg-white shadow-lg"
              style={{ top: suggestionPos.top + 8, left: suggestionPos.left }}
            >
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                {suggestionItems.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertVariableAtCursor(name);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
