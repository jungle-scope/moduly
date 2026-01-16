'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { LogList } from '@/app/features/workflow/components/logs/LogList';
import { LogDetail } from '@/app/features/workflow/components/logs/LogDetail';
import {
  LogFilterBar,
  LogFilters,
} from '@/app/features/workflow/components/logs/LogFilterBar';
import { LogDetailComparisonModal } from '@/app/features/workflow/components/logs/ab-test/LogDetailComparisonModal';
import { LogCompareSelectionModal } from '@/app/features/workflow/components/logs/ab-test/LogCompareSelectionModal';
import { LogABTestBar } from '@/app/features/workflow/components/logs/ab-test/LogABTestBar';
import { LogSelectionOverlay } from '@/app/features/workflow/components/logs/ab-test/LogSelectionOverlay';
import { useABTestComparison } from '@/app/features/workflow/hooks/useABTestComparison';

interface LogTabProps {
  workflowId: string;
  initialRunId?: string | null;
}

// [BEST PRACTICE] 순수 함수는 컴포넌트 외부에 정의
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const LogTab = ({ workflowId, initialRunId }: LogTabProps) => {
  const [logs, setLogs] = useState<WorkflowRun[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WorkflowRun[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkflowRun | null>(null);
  const [compareLog, setCompareLog] = useState<WorkflowRun | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'compare'>(
    'list',
  );

  // A/B 테스트 상태 (Custom Hook 사용)
  const {
    isOpen: isABTestOpen,
    runA: abRunA,
    runB: abRunB,
    selectionTarget,
    sectionRef: abSectionRef,
    toggle: setIsABTestOpen,
    reset: resetABTest,
    selectRun: selectABRun,
    startCompare: startABHookCompare,
    setSelectionTarget, 
  } = useABTestComparison(workflowId);

  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // ========================
  // 1. 데이터 로딩 (Data Fetching)
  // ========================
  const fetchAndSelectRun = useCallback(async (runId: string) => {
    if (!isValidUUID(workflowId)) return;
    try {
      const run = await workflowApi.getWorkflowRun(workflowId, runId);
      setSelectedLog(run);
      setViewMode('detail');
    } catch (err) {
      console.error('Failed to fetch initial run:', err);
      setViewMode('list');
    }
  }, [workflowId]);

  const loadLogs = useCallback(async () => {
    try {
      setLogLoading(true);
      const response = await workflowApi.getWorkflowRuns(workflowId, logPage);
      setLogs(response.items);
      setFilteredLogs(response.items);
    } catch (error) {
      console.error('Failed to load workflow runs:', error);
    } finally {
      setLogLoading(false);
    }
  }, [workflowId, logPage]);

  // ========================
  // 2. 리스트 필터링 (Filtering)
  // ========================
  const handleFilterChange = useCallback((filters: LogFilters) => {
    let result = [...logs];

    if (filters.status !== 'all') {
      result = result.filter((log) => log.status === filters.status);
    }

    if (filters.dateRange.start) {
      result = result.filter(
        (log) => new Date(log.started_at) >= filters.dateRange.start!,
      );
    }
    if (filters.dateRange.end) {
      result = result.filter(
        (log) => new Date(log.started_at) <= filters.dateRange.end!,
      );
    }

    // 정렬 적용
    switch (filters.sortBy) {
      case 'latest':
        result.sort(
          (a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
        );
        break;
      case 'oldest':
        result.sort(
          (a, b) =>
            new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
        );
        break;
      case 'tokens_high':
        result.sort((a, b) => (b.total_tokens || 0) - (a.total_tokens || 0));
        break;
      case 'tokens_low':
        result.sort((a, b) => (a.total_tokens || 0) - (b.total_tokens || 0));
        break;
      case 'cost_high':
        result.sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));
        break;
      case 'cost_low':
        result.sort((a, b) => (a.total_cost || 0) - (b.total_cost || 0));
        break;
      case 'duration_long':
        result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
        break;
      case 'duration_short':
        result.sort((a, b) => (a.duration || 0) - (b.duration || 0));
        break;
    }

    setFilteredLogs(result);
  }, [logs]);

  // ========================
  // 3. 로그 선택 및 네비게이션 (Navigation)
  // ========================
  const handleLogSelect = async (log: WorkflowRun) => {
    // A/B 선택 모드 (Hook 위임)
    const { handled } = selectABRun(log);
    if (handled) return;

    // Default Navigation - 상세 API 호출하여 node_runs 포함한 전체 데이터 가져오기
    try {
      const detailedRun = await workflowApi.getWorkflowRun(workflowId, log.id);
      setSelectedLog(detailedRun);
      setViewMode('detail');
    } catch (error) {
      console.error('Failed to fetch run details:', error);
      // 실패 시 목록 데이터라도 표시
      setSelectedLog(log);
      setViewMode('detail');
    }
  };

  const handleBackToList = useCallback(() => {
    setSelectedLog(null);
    setCompareLog(null);
    setViewMode('list');
  }, []);

  // ========================
  // 4. 비교 기능 (Comparison & A/B Test)
  // ========================
  const handleCompareClick = useCallback(() => {
    setIsCompareModalOpen(true);
  }, []);

  const handleCompareSelect = useCallback(async (targetRun: WorkflowRun) => {
    setIsCompareModalOpen(false);
    try {
      // 비교 대상의 상세 정보(node_runs 포함) 가져오기
      const detailedRun = await workflowApi.getWorkflowRun(workflowId, targetRun.id);
      setCompareLog(detailedRun);
      setViewMode('compare');
    } catch (err) {
      console.error('Failed to fetch compare run details:', err);
      // 실패 시 기존 데이터로 진행
      setCompareLog(targetRun);
      setViewMode('compare');
    }
  }, [workflowId]);

  const startABCompare = useCallback(async () => {
    const result = await startABHookCompare();
    if (result) {
      setSelectedLog(result.selectedLog);
      setCompareLog(result.compareLog);
      setViewMode('compare');
    }
  }, [startABHookCompare]);

  // ========================
  // 이펙트 (함수 선언 후 배치)
  // ========================
  
  // 초기 로드
  useEffect(() => {
    if (workflowId && isValidUUID(workflowId)) {
      loadLogs();
    }
  }, [workflowId, loadLogs]);

  // 모니터링에서 네비게이션 시 initialRunId 변경 처리
  useEffect(() => {
    if (initialRunId) {
      fetchAndSelectRun(initialRunId);
    }
  }, [initialRunId, fetchAndSelectRun]);

  // 목록 컨텐츠 렌더링 (로딩, 빈 상태, 목록 등)
  const renderLogListContent = () => {
    if (logLoading && logs.length === 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mb-3" />
          <p>로그를 불러오는 중입니다...</p>
        </div>
      );
    }

    if (logs.length === 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <Clock className="w-12 h-12 mb-3 opacity-20" />
          <p>실행 기록이 없습니다.</p>
        </div>
      );
    }

    if (filteredLogs.length === 0) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <p>필터 조건에 맞는 로그가 없습니다.</p>
        </div>
      );
    }

    return (
      <LogList
        logs={filteredLogs}
        onSelect={handleLogSelect}
        selectedLogId={selectedLog?.id}
        className=""
        selectionMode={selectionTarget}
        abRunAId={abRunA?.id}
        abRunBId={abRunB?.id}
      />
    );
  };



  return (
    <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
      {/* 상세/비교 헤더 네비게이션 */}
      {(viewMode === 'detail' || viewMode === 'compare') && (
        <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center gap-2">
          <button
            onClick={handleBackToList}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-semibold text-gray-700">
            {viewMode === 'compare' ? '로그 비교' : '로그 상세'}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {/* 뷰: 목록 모드 */}
        <div
          className={`h-full w-full ${viewMode === 'list' ? 'block' : 'hidden'}`}
        >
          <div className="h-full max-w-5xl mx-auto p-6 overflow-y-auto scroll-smooth pb-20 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <LogFilterBar
              onFilterChange={handleFilterChange}
              availableVersions={[]}
            />

            <div
              ref={abSectionRef}
              className="scroll-mt-4 transition-all duration-300 mb-4"
            >
              <LogABTestBar
                isOpen={isABTestOpen}
                onToggle={() => setIsABTestOpen(!isABTestOpen)}
                runA={abRunA}
                runB={abRunB}
                selectionTarget={selectionTarget}
                onSelectTarget={setSelectionTarget}
                onCompare={startABCompare}
                onReset={resetABTest}
              />
            </div>

            {/* 로그 목록 컨테이너 */}
            <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm relative min-h-[400px]">
              {/* 선택 오버레이 */}
              <LogSelectionOverlay selectionTarget={selectionTarget} />

              {renderLogListContent()}
            </div>
          </div>
        </div>

        {/* 뷰: 상세 모드 */}
        {viewMode === 'detail' && selectedLog && (
          <div className="h-full w-full bg-white overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-1 overflow-hidden p-6 max-w-6xl mx-auto w-full">
              <LogDetail
                run={selectedLog}
                onCompareClick={handleCompareClick}
              />
            </div>
          </div>
        )}

        {/* 뷰: 비교 모드 */}
        {viewMode === 'compare' && selectedLog && compareLog && (
          <LogDetailComparisonModal
            runA={selectedLog}
            runB={compareLog}
            onBack={() => setViewMode('detail')}
          />
        )}
      </div>

      {/* 비교 선택 모달 */}
      <LogCompareSelectionModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        onSelect={handleCompareSelect}
        currentRunId={selectedLog?.id || ''}
        logs={logs}
      />
    </div>
  );
};
