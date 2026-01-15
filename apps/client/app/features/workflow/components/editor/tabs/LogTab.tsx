'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Clock } from 'lucide-react';

import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { LogList } from '@/app/features/workflow/components/logs/LogList';
import { LogDetail } from '@/app/features/workflow/components/logs/LogDetail';
import {
  LogFilterBar,
  LogFilters,
} from '@/app/features/workflow/components/logs/LogFilterBar';
import { LogDetailComparisonModal } from '@/app/features/workflow/components/logs/LogDetailComparisonModal';
import { LogCompareSelectionModal } from '@/app/features/workflow/components/logs/LogCompareSelectionModal';
import { LogABTestBar } from '@/app/features/workflow/components/logs/LogABTestBar';

interface LogTabProps {
  workflowId: string;
  initialRunId?: string | null;
}

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

  // A/B Test State
  const [isABTestOpen, setIsABTestOpen] = useState(false);
  const [abRunA, setABRunA] = useState<WorkflowRun | null>(null);
  const [abRunB, setABRunB] = useState<WorkflowRun | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<'A' | 'B' | null>(
    null,
  );
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const abSectionRef = useRef<HTMLDivElement>(null);

  // UUID 형식 검증 함수
  const isValidUUID = (id: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  // Initial Load
  useEffect(() => {
    if (workflowId && isValidUUID(workflowId)) {
      loadLogs();
    }
  }, [workflowId]);

  // Handle initialRunId change (e.g. navigation from Monitoring)
  useEffect(() => {
    if (initialRunId) {
      fetchAndSelectRun(initialRunId);
    } else {
      // If cleared or null, maybe stay or list?
      // Usually only nav sets this.
      // If we want to support resetting, we might need logic.
      // For now, if provided, we select.
    }
  }, [initialRunId]);

  // Auto-scroll to A/B Section when opened
  useEffect(() => {
    if (isABTestOpen && abSectionRef.current) {
      setTimeout(() => {
        abSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  }, [isABTestOpen]);

  // ========================
  // LOG FUNCTIONS
  // ========================
  const fetchAndSelectRun = async (runId: string) => {
    if (!isValidUUID(workflowId)) return;
    try {
      const run = await workflowApi.getWorkflowRun(workflowId, runId);
      setSelectedLog(run);
      setViewMode('detail');
    } catch (err) {
      console.error('Failed to fetch initial run:', err);
      setViewMode('list');
    }
  };

  const loadLogs = async () => {
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
  };

  const handleFilterChange = (filters: LogFilters) => {
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

    // Apply sorting
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
  };

  const handleLogSelect = async (log: WorkflowRun) => {
    // A/B Selection Mode
    if (selectionTarget === 'A') {
      if (abRunB?.id === log.id) {
        alert('이미 B(비교군)로 선택된 실행입니다. 다른 실행을 선택해주세요.');
        return;
      }
      setABRunA(log);
      setSelectionTarget(null);
      if (abRunB) {
        setTimeout(() => {
          abSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
      return;
    }
    if (selectionTarget === 'B') {
      if (abRunA?.id === log.id) {
        alert('이미 A(기준)로 선택된 실행입니다. 다른 실행을 선택해주세요.');
        return;
      }
      setABRunB(log);
      setSelectionTarget(null);
      if (abRunA) {
        setTimeout(() => {
          abSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
      return;
    }

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

  const handleBackToList = () => {
    setSelectedLog(null);
    setCompareLog(null);
    setViewMode('list');
  };

  const handleCompareClick = () => {
    setIsCompareModalOpen(true);
  };

  const handleCompareSelect = async (targetRun: WorkflowRun) => {
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
  };

  const startABCompare = async () => {
    if (abRunA && abRunB) {
      try {
        // A/B 모두 상세 정보 가져오기
        const [detailedA, detailedB] = await Promise.all([
          workflowApi.getWorkflowRun(workflowId, abRunA.id),
          workflowApi.getWorkflowRun(workflowId, abRunB.id),
        ]);
        setSelectedLog(detailedA);
        setCompareLog(detailedB);
        setViewMode('compare');
      } catch (err) {
        console.error('Failed to fetch A/B run details:', err);
        // 실패 시 기존 데이터로 진행
        setSelectedLog(abRunA);
        setCompareLog(abRunB);
        setViewMode('compare');
      }
    }
  };

  const resetABTest = () => {
    setABRunA(null);
    setABRunB(null);
    setSelectionTarget(null);
  };

  return (
    <div className="h-full w-full bg-gray-100 flex flex-col overflow-hidden">
      {/* Detail/Compare Header Navigation */}
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
        {/* VIEW: LIST MODE */}
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

            {/* Log List */}
            <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm relative min-h-[400px]">
              {/* Selection Overlay */}
              {selectionTarget && (
                <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-2 z-20 opacity-95 shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                  <span>👇 목록에서 </span>
                  <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full">
                    Run {selectionTarget}
                  </span>
                  <span> 로 사용할 실행 기록을 클릭하세요</span>
                </div>
              )}

              {logLoading && logs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mb-3" />
                  <p>로그를 불러오는 중입니다...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <Clock className="w-12 h-12 mb-3 opacity-20" />
                  <p>실행 기록이 없습니다.</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                  <p>필터 조건에 맞는 로그가 없습니다.</p>
                </div>
              ) : (
                <LogList
                  logs={filteredLogs}
                  onSelect={handleLogSelect}
                  selectedLogId={selectedLog?.id}
                  className=""
                  selectionMode={selectionTarget}
                  abRunAId={abRunA?.id}
                  abRunBId={abRunB?.id}
                />
              )}
            </div>
          </div>
        </div>

        {/* VIEW: DETAIL MODE */}
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

        {/* VIEW: COMPARE MODE */}
        {viewMode === 'compare' && selectedLog && compareLog && (
          <LogDetailComparisonModal
            runA={selectedLog}
            runB={compareLog}
            onBack={() => setViewMode('detail')}
          />
        )}
      </div>

      {/* Compare Selection Modal */}
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
