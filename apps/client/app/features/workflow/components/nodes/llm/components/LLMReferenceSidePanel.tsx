import { X, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  knowledgeApi,
  KnowledgeBaseResponse,
  KnowledgeBaseDetailResponse,
} from '@/app/features/knowledge/api/knowledgeApi';
import { LLMNodeData } from '../../../../types/Nodes';

interface LLMReferenceSidePanelProps {
  nodeId: string;
  data: LLMNodeData;
  onClose: () => void;
}

export function LLMReferenceSidePanel({
  nodeId,
  data,
  onClose,
}: LLMReferenceSidePanelProps) {
  const { updateNodeData } = useWorkflowStore();
  
  // Knowledge base state
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, KnowledgeBaseDetailResponse>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Selected knowledge bases from LLM node data
  const selectedKnowledgeBases = data.knowledgeBases || [];
  const selectedIds = useMemo(
    () => new Set(selectedKnowledgeBases.map((kb) => kb.id)),
    [selectedKnowledgeBases],
  );

  // Search settings
  const scoreThreshold = data.scoreThreshold ?? 0.5;
  const topK = data.topK ?? 3;
  const recommendedScoreRange: [number, number] = [0.3, 0.6];
  const recommendedTopKRange: [number, number] = [3, 8];

  // Fetch knowledge bases on mount
  useEffect(() => {
    const fetchBases = async () => {
      setLoading(true);
      setError(null);
      try {
        const bases = await knowledgeApi.getKnowledgeBases();
        setKnowledgeBases(bases);
      } catch (err) {
        console.error('Failed to load knowledge bases', err);
        setError('참고 자료를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchBases();
  }, []);

  // Toggle selection
  const toggleKnowledgeBase = (kb: KnowledgeBaseResponse) => {
    const current = selectedKnowledgeBases;
    let next;
    if (selectedIds.has(kb.id)) {
      next = current.filter((item) => item.id !== kb.id);
    } else {
      next = [...current, { id: kb.id, name: kb.name }];
    }
    updateNodeData(nodeId, { knowledgeBases: next });
  };

  // Toggle expand/collapse for document list
  const handleToggleExpand = async (kb: KnowledgeBaseResponse) => {
    const nextExpanded = new Set(expandedIds);
    if (nextExpanded.has(kb.id)) {
      nextExpanded.delete(kb.id);
      setExpandedIds(nextExpanded);
      return;
    }

    nextExpanded.add(kb.id);
    setExpandedIds(nextExpanded);

    if (!details[kb.id]) {
      setDetailLoading((prev) => ({ ...prev, [kb.id]: true }));
      try {
        const detail = await knowledgeApi.getKnowledgeBase(kb.id);
        setDetails((prev) => ({ ...prev, [kb.id]: detail }));
      } catch (err) {
        console.error('Failed to load knowledge base detail', err);
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

  const topKIndicator = useMemo(() => {
    const max = 20;
    const clamped = Math.min(max, Math.max(1, topK));
    return (clamped / max) * 100;
  }, [topK]);

  return (
    <div
      className="absolute right-[400px] top-0 h-full w-[360px] bg-white shadow-xl z-40 flex flex-col border-l border-gray-200"
      style={{ transition: 'transform 0.3s ease-in-out' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-indigo-50/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-600" />
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">참고 자료</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">
              LLM이 참조할 참고 자료 그룹을 선택합니다
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Knowledge Base Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">참고 자료 그룹 선택</span>
            <span className="text-xs text-gray-500">
              선택됨: <span className="font-semibold text-indigo-600">{selectedIds.size}</span>
            </span>
          </div>

          {loading && (
            <div className="text-xs text-indigo-600 animate-pulse">불러오는 중...</div>
          )}
          {error && (
            <div className="text-xs text-red-500">{error}</div>
          )}

          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {knowledgeBases.map((kb) => {
              const isSelected = selectedIds.has(kb.id);
              const isExpanded = expandedIds.has(kb.id);
              const kbDetail = details[kb.id];
              const kbDetailLoading = detailLoading[kb.id];
              const completedDocs = kbDetail?.documents?.filter(
                (doc) => doc.status === 'completed',
              ) || [];

              return (
                <div
                  key={kb.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleKnowledgeBase(kb)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {kb.name}
                        </span>
                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                          {formatDate(kb.created_at)} · {kb.document_count}건
                        </span>
                      </div>
                      {kb.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                          {kb.description}
                        </p>
                      )}
                    </div>
                  </label>

                  {/* Expand/Collapse Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(kb)}
                    className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 py-1 rounded hover:bg-indigo-100/50"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        문서 숨기기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        문서 보기
                      </>
                    )}
                  </button>

                  {/* Document List */}
                  {isExpanded && (
                    <div className="mt-2 rounded border border-gray-200 bg-white">
                      {kbDetailLoading ? (
                        <div className="px-3 py-2 text-xs text-indigo-600 animate-pulse">
                          불러오는 중...
                        </div>
                      ) : completedDocs.length > 0 ? (
                        <div className="max-h-24 overflow-y-auto divide-y divide-gray-100">
                          {completedDocs.slice(0, 5).map((doc, index) => (
                            <div
                              key={doc.id || `${kb.id}-doc-${index}`}
                              className="px-3 py-1.5 text-xs text-gray-900 flex items-center justify-between"
                            >
                              <span className="truncate flex-1">{doc.filename}</span>
                              <span className="text-[10px] text-gray-500 ml-2">
                                {doc.chunk_count ?? 0}청크
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-500">
                          완료된 문서가 없습니다.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {!loading && knowledgeBases.length === 0 && !error && (
              <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                등록된 참고 자료 그룹이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Search Settings */}
        <div className="space-y-4 border-t border-gray-100 pt-4">
          <span className="text-sm font-medium text-gray-700">검색 설정</span>

          {/* Score Threshold */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-600">Score Threshold</label>
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {scoreThreshold.toFixed(2)}
              </span>
            </div>
            <div className="relative h-7">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-gray-100 ring-1 ring-gray-200 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-y-0 bg-indigo-200"
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
                className="absolute inset-0 w-full h-6 bg-transparent accent-indigo-600 appearance-none cursor-pointer
                  [&::-webkit-slider-runnable-track]:bg-transparent
                  [&::-moz-range-track]:bg-transparent
                  [&::-ms-track]:bg-transparent"
                style={{ background: 'transparent' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>느슨하게</span>
              <span className="text-indigo-500">권장: {recommendedScoreRange[0]}~{recommendedScoreRange[1]}</span>
              <span>엄격하게</span>
            </div>
          </div>

          {/* Top K */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-600">Top K (반환 개수)</label>
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {topK}
              </span>
            </div>
            <div className="relative h-7">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2.5 rounded-full bg-gray-100 ring-1 ring-gray-200 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-y-0 bg-indigo-200"
                  style={{
                    left: `${(recommendedTopKRange[0] / 20) * 100}%`,
                    right: `${(1 - recommendedTopKRange[1] / 20) * 100}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-indigo-600"
                  style={{ left: `${(topK / 20) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={topK}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  updateNodeData(nodeId, {
                    topK: Number.isNaN(value) ? undefined : value,
                  });
                }}
                className="absolute inset-0 w-full h-6 bg-transparent accent-indigo-600 appearance-none cursor-pointer
                  [&::-webkit-slider-runnable-track]:bg-transparent
                  [&::-moz-range-track]:bg-transparent
                  [&::-ms-track]:bg-transparent"
                style={{ background: 'transparent' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1</span>
              <span className="text-indigo-500">권장: {recommendedTopKRange[0]}~{recommendedTopKRange[1]}</span>
              <span>20</span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1">
          <p className="text-xs font-medium text-blue-800">💡 사용 방법</p>
          <p className="text-[11px] text-blue-700">
            선택한 참고 자료 그룹에서 사용자 프롬프트를 기반으로 관련 문서를 검색하여 LLM에 컨텍스트로 제공합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
