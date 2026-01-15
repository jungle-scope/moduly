'use client';
import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  Check,
  Loader2,
  Eye,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  Search,
} from 'lucide-react';
import { DocumentSegment } from '@/app/features/knowledge/api/knowledgeApi';

interface ChunkPreviewListProps {
  previewSegments: DocumentSegment[];
  isLoading: boolean;
  headerButton?: React.ReactNode;
}

const ITEMS_PER_PAGE = 50;

export default function ChunkPreviewList({
  previewSegments,
  isLoading,
  headerButton,
}: ChunkPreviewListProps) {
  // previewSegments의 길이를 기반으로 리셋 키 생성
  const segmentsKey = previewSegments.length;

  // Collapsible 상태 관리 (기본값: 모두 collapsed)
  const [collapsedStates, setCollapsedStates] = useState<
    Record<number, boolean>
  >({});

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [goToChunkInput, setGoToChunkInput] = useState('');

  // 하이라이트 상태 (N번 조각 이동 시)
  const [highlightedChunk, setHighlightedChunk] = useState<number | null>(null);

  // 스크롤 컨테이너 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // previewSegments가 변경되면 상태 초기화 (key 기반으로 처리)
  const [prevSegmentsKey, setPrevSegmentsKey] = useState(segmentsKey);
  if (segmentsKey !== prevSegmentsKey) {
    setCollapsedStates({});
    setCurrentPage(1);
    setGoToChunkInput('');
    setHighlightedChunk(null);
    setPrevSegmentsKey(segmentsKey);
  }

  // 페이지네이션 계산
  const totalPages = Math.ceil(previewSegments.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, previewSegments.length);
  const currentSegments = previewSegments.slice(startIdx, endIdx);

  // 조각 접힘 상태 확인 (기본값: true = collapsed)
  const isCollapsed = (globalIdx: number) =>
    collapsedStates[globalIdx] !== false;

  // 토글 함수
  const toggleCollapse = (globalIdx: number) => {
    setCollapsedStates((prev) => ({
      ...prev,
      [globalIdx]: !isCollapsed(globalIdx),
    }));
  };

  // 전체 펼치기 (현재 페이지)
  const expandAll = () => {
    const updates: Record<number, boolean> = {};
    currentSegments.forEach((_, localIdx) => {
      const globalIdx = startIdx + localIdx;
      updates[globalIdx] = false;
    });
    setCollapsedStates((prev) => ({ ...prev, ...updates }));
  };

  // 전체 접기 (현재 페이지)
  const collapseAll = () => {
    const updates: Record<number, boolean> = {};
    currentSegments.forEach((_, localIdx) => {
      const globalIdx = startIdx + localIdx;
      updates[globalIdx] = true;
    });
    setCollapsedStates((prev) => ({ ...prev, ...updates }));
  };

  // 현재 페이지에서 펼쳐진 조각이 있는지 확인
  const hasExpandedInCurrentPage = useMemo(() => {
    return currentSegments.some((_, localIdx) => {
      const globalIdx = startIdx + localIdx;
      return collapsedStates[globalIdx] === false;
    });
  }, [currentSegments, collapsedStates, startIdx]);

  // 요약 통계 계산
  const statistics = useMemo(() => {
    if (previewSegments.length === 0) return null;

    const charCounts = previewSegments.map((s) => s.char_count);
    const tokenCounts = previewSegments.map((s) => s.token_count);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr: number[]) => Math.round(sum(arr) / arr.length);

    return {
      total: previewSegments.length,
      charAvg: avg(charCounts),
      charMin: Math.min(...charCounts),
      charMax: Math.max(...charCounts),
      tokenAvg: avg(tokenCounts),
      tokenMin: Math.min(...tokenCounts),
      tokenMax: Math.max(...tokenCounts),
      totalChars: sum(charCounts),
      totalTokens: sum(tokenCounts),
    };
  }, [previewSegments]);

  // N번 조각으로 이동 (스크롤 + 하이라이트)
  const handleGoToChunk = useCallback(() => {
    const chunkNum = parseInt(goToChunkInput, 10);
    if (isNaN(chunkNum) || chunkNum < 1 || chunkNum > previewSegments.length) {
      return;
    }
    const targetPage = Math.ceil(chunkNum / ITEMS_PER_PAGE);
    const globalIdx = chunkNum - 1;

    // 페이지 이동 + 조각 펼치기
    setCurrentPage(targetPage);
    setCollapsedStates((prev) => ({ ...prev, [globalIdx]: false }));
    setGoToChunkInput('');

    // 하이라이트 설정
    setHighlightedChunk(globalIdx);

    // 렌더링 후 스크롤 (requestAnimationFrame으로 다음 프레임에 실행)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const element = document.getElementById(`chunk-${globalIdx}`);
        if (element && scrollContainerRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    // 2초 후 하이라이트 해제
    setTimeout(() => {
      setHighlightedChunk(null);
    }, 2000);
  }, [goToChunkInput, previewSegments.length]);

  // 페이지 변경
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // 페이지 번호 렌더링 (최대 5개)
  const renderPageNumbers = () => {
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);

    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages.map((page) => (
      <button
        key={page}
        onClick={() => goToPage(page)}
        className={`px-2.5 py-1 text-xs rounded transition-colors ${
          page === currentPage
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        {page}
      </button>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Check className="w-4 h-4" />
            분할 결과 미리보기
          </h3>
          {statistics && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {statistics.total.toLocaleString()}개 조각 ·{' '}
              {statistics.totalTokens.toLocaleString()} 토큰
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerButton}
          {previewSegments.length > 0 && (
            <button
              onClick={hasExpandedInCurrentPage ? collapseAll : expandAll}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={hasExpandedInCurrentPage ? '전체 접기' : '전체 펼치기'}
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
              {hasExpandedInCurrentPage ? '전체 접기' : '전체 펼치기'}
            </button>
          )}
        </div>
      </div>

      {/* 조각 목록 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-2 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col relative"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 animate-in fade-in">
            <Loader2 className="w-8 h-8 mb-2 animate-spin text-blue-500" />
            <p className="text-sm">문서를 분석하여 조각내고 있습니다...</p>
          </div>
        ) : previewSegments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-full mb-4">
              <Eye className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-1">
              미리보기 결과가 없습니다
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              왼쪽에서 설정 후{' '}
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                [결과 미리보기]
              </span>{' '}
              클릭
            </p>
          </div>
        ) : (
          currentSegments.map((segment, localIdx) => {
            const globalIdx = startIdx + localIdx;
            const collapsed = isCollapsed(globalIdx);
            const isHighlighted = highlightedChunk === globalIdx;

            return (
              <div
                key={globalIdx}
                id={`chunk-${globalIdx}`}
                className={`bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:shadow-md transition-all duration-300 ${
                  isHighlighted
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* 조각 헤더 - 클릭으로 토글 */}
                <button
                  onClick={() => toggleCollapse(globalIdx)}
                  className="w-full px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30 rounded-t-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2">
                    {collapsed ? (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-xs font-semibold text-gray-500">
                      조각 #{globalIdx + 1}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span>{segment.char_count}자</span>
                    <span>•</span>
                    <span>{segment.token_count}토큰</span>
                  </div>
                </button>

                {/* 조각 내용 - 펼쳤을 때만 표시 */}
                {!collapsed && (
                  <div className="p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {segment.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 컨트롤 */}
      {previewSegments.length > ITEMS_PER_PAGE && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
          {/* 범위 표시 */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {(startIdx + 1).toLocaleString()}-{endIdx.toLocaleString()} /{' '}
            {previewSegments.length.toLocaleString()}개
          </span>

          {/* 페이지 네비게이션 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {renderPageNumbers()}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* N번 조각으로 이동 */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={goToChunkInput}
              onChange={(e) => setGoToChunkInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGoToChunk()}
              placeholder="N번"
              min={1}
              max={previewSegments.length}
              className="w-16 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <button
              onClick={handleGoToChunk}
              className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="이동"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
