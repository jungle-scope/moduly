'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ScrollText, BarChart3 } from 'lucide-react';

// Log Components
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowRun, DashboardStatsResponse } from '@/app/features/workflow/types/Api';
import { LogList } from '@/app/features/workflow/components/logs/LogList';
import { LogDetail } from '@/app/features/workflow/components/logs/LogDetail';
import { LogFilterBar, LogFilters } from '@/app/features/workflow/components/logs/LogFilterBar';
import { LogDetailComparisonModal } from '@/app/features/workflow/components/logs/LogDetailComparisonModal';
import { LogCompareSelectionModal } from '@/app/features/workflow/components/logs/LogCompareSelectionModal';
import { LogABTestBar } from '@/app/features/workflow/components/logs/LogABTestBar';

// Monitoring Components
import { StatisticsCards } from '@/app/features/workflow/components/monitoring/StatisticsCards';
import { RunsOverTimeChart } from '@/app/features/workflow/components/monitoring/charts/RunsOverTimeChart';
import { CostEfficiencySection } from '@/app/features/workflow/components/monitoring/CostEfficiencySection';
import { FailureAnalysis } from '@/app/features/workflow/components/monitoring/FailureAnalysis';
import { getNodeDisplayInfo } from '@/app/features/workflow/utils/nodeDisplayUtils';
import { Clock, Zap, AlertTriangle, TrendingUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface LogAndMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  initialTab?: 'logs' | 'monitoring';
  initialRunId?: string | null;
}

export const LogAndMonitoringModal = ({
  isOpen,
  onClose,
  workflowId,
  initialTab = 'logs',
  initialRunId,
}: LogAndMonitoringModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'logs' | 'monitoring'>(initialTab);
  // Track where navigation came from for proper back behavior
  const [navigatedFromMonitoring, setNavigatedFromMonitoring] = useState(false);

  // ========================
  // LOG STATE (from LogViewerModal)
  // ========================
  const [logs, setLogs] = useState<WorkflowRun[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WorkflowRun[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkflowRun | null>(null);
  const [compareLog, setCompareLog] = useState<WorkflowRun | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'compare'>('list');
  
  // A/B Test State
  const [isABTestOpen, setIsABTestOpen] = useState(false);
  const [abRunA, setABRunA] = useState<WorkflowRun | null>(null);
  const [abRunB, setABRunB] = useState<WorkflowRun | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<'A' | 'B' | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const abSectionRef = useRef<HTMLDivElement>(null);

  // ========================
  // MONITORING STATE (from MonitoringDashboardModal)
  // ========================
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringScrollPos, setMonitoringScrollPos] = useState(0);
  const monitoringScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && workflowId) {
      // Set initial tab
      if (initialRunId) {
        setActiveTab('logs');
        fetchAndSelectRun(initialRunId);
      } else {
        setActiveTab(initialTab);
        setViewMode('list');
        setSelectedLog(null);
      }

      // Load both data
      loadLogs();
      loadStats();

      // Reset state
      setCompareLog(null);
      setIsABTestOpen(false);
      setABRunA(null);
      setABRunB(null);
      setSelectionTarget(null);
    }
  }, [isOpen, workflowId, initialRunId, initialTab]);

  // Auto-scroll to A/B Section when opened
  useEffect(() => {
    if (isABTestOpen && abSectionRef.current) {
      setTimeout(() => {
        abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isABTestOpen]);

  // ESC 키로 A/B 테스트 모드 종료 (X 버튼과 동일한 동작)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isABTestOpen) {
        // X 버튼과 동일: onReset() + onToggle()
        setABRunA(null);
        setABRunB(null);
        setSelectionTarget(null);
        setIsABTestOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isABTestOpen]);

  // ========================
  // LOG FUNCTIONS
  // ========================
  const fetchAndSelectRun = async (runId: string) => {
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
      result = result.filter((log) => new Date(log.started_at) >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      result = result.filter((log) => new Date(log.started_at) <= filters.dateRange.end!);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'latest':
        result.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
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

  const handleLogSelect = (log: WorkflowRun) => {
    // A/B Selection Mode
    if (selectionTarget === 'A') {
      if (abRunB?.id === log.id) {
        alert('이미 B(비교군)로 선택된 실행입니다. 다른 실행을 선택해주세요.');
        return;
      }
      setABRunA(log);
      
      // [MODIFIED] B가 없으면 자동으로 B 선택 모드로 전환
      if (!abRunB) {
         setSelectionTarget('B');
      } else {
         setSelectionTarget(null);
         setTimeout(() => {
           abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
          abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      return;
    }

    // Default Navigation
    setSelectedLog(log);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    // If came from monitoring, go back to monitoring tab
    if (navigatedFromMonitoring) {
      setNavigatedFromMonitoring(false);
      setSelectedLog(null);
      setCompareLog(null);
      setViewMode('list');
      setActiveTab('monitoring');
      return;
    }
    setSelectedLog(null);
    setCompareLog(null);
    setViewMode('list');
  };

  const handleCompareClick = () => {
    setIsCompareModalOpen(true);
  };

  const handleCompareSelect = (targetRun: WorkflowRun) => {
    setIsCompareModalOpen(false);
    setCompareLog(targetRun);
    setViewMode('compare');
  };

  const startABCompare = () => {
    if (abRunA && abRunB) {
      setSelectedLog(abRunA);
      setCompareLog(abRunB);
      setViewMode('compare');
    }
  };

  const resetABTest = () => {
    setABRunA(null);
    setABRunB(null);
    setSelectionTarget(null);
  };

  const logStats = {
    totalRuns: logs.length,
    successCount: logs.filter((l) => l.status === 'success').length || 0,
    failureCount: logs.filter((l) => l.status === 'failed').length || 0,
    avgDuration: logs.reduce((acc, curr) => acc + (curr.duration || 0), 0) / (logs.length || 1),
  };

  // ========================
  // MONITORING FUNCTIONS
  // ========================
  const loadStats = async () => {
    try {
      setMonitoringLoading(true);
      const data = await workflowApi.getDashboardStats(workflowId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setMonitoringLoading(false);
    }
  };

  const handleNavigateToLog = (runId: string) => {
    // Save scroll position
    if (monitoringScrollRef.current) {
      setMonitoringScrollPos(monitoringScrollRef.current.scrollTop);
    }
    // Mark that we're coming from monitoring
    setNavigatedFromMonitoring(true);
    // Navigate to log detail
    fetchAndSelectRun(runId);
    setActiveTab('logs');
  };

  // Monitoring chart data
  const runsOverTimeData =
    stats?.runsOverTime.map((d) => ({
      name: d.date,
      runs: d.count,
      total_cost: d.total_cost,
      total_tokens: d.total_tokens,
    })) || [];

  const failureData =
    stats?.failureAnalysis.map((f) => ({
      node: f.node_name,
      count: f.count,
      reason: f.reason,
      rate: f.rate,
    })) || [];

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            {activeTab === 'logs' && viewMode === 'detail' && (
              <button
                onClick={handleBackToList}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-xl font-bold text-gray-800">
              {activeTab === 'logs'
                ? viewMode === 'list'
                  ? '워크플로우 실행 기록'
                  : '실행 상세 정보'
                : '모니터링 대시보드'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation (like Statistics page) - 모니터링 | 로그 순서 */}
        {viewMode !== 'compare' && (
          <div className="px-6 border-b border-gray-200 bg-white shrink-0">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('monitoring')}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'monitoring'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                모니터링
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <ScrollText className="w-4 h-4" />
                로그
              </button>
            </nav>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-hidden bg-gray-50">
          {/* ==========================
              LOG TAB CONTENT
          ========================== */}
          {activeTab === 'logs' && (
            <>
              {/* VIEW: LIST MODE */}
              {viewMode === 'list' && (
                <div className="h-full max-w-4xl mx-auto p-6 overflow-y-auto scroll-smooth pb-20 block animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <LogFilterBar onFilterChange={handleFilterChange} availableVersions={[]} />

                  <div ref={abSectionRef} className="scroll-mt-4 transition-all duration-300 mb-4">
                    <LogABTestBar
                      isOpen={isABTestOpen}
                      onToggle={() => {
                        const newOpen = !isABTestOpen;
                        setIsABTestOpen(newOpen);
                        if (newOpen && !abRunA) {
                          setSelectionTarget('A');
                        }
                      }}
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
              )}

              {/* VIEW: DETAIL MODE */}
              {viewMode === 'detail' && selectedLog && (
                <div className="h-full w-full bg-white overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex-1 overflow-hidden p-6 max-w-6xl mx-auto w-full">
                    <LogDetail run={selectedLog} onCompareClick={handleCompareClick} />
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

              {/* Compare Selection Modal */}
              <LogCompareSelectionModal
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                onSelect={handleCompareSelect}
                currentRunId={selectedLog?.id || ''}
                logs={logs}
              />
            </>
          )}

          {/* ==========================
              MONITORING TAB CONTENT
          ========================== */}
          {activeTab === 'monitoring' && (
            <div
              ref={monitoringScrollRef}
              className="h-full overflow-y-auto bg-gray-50 p-6 scroll-smooth animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="max-w-7xl mx-auto space-y-6 pb-10">
                {monitoringLoading || !stats ? (
                  <div className="h-64 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 animate-pulse">
                    <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
                    <span className="text-gray-400 font-medium">실시간 통계 분석 중...</span>
                  </div>
                ) : (
                  <>
                    {/* 1. 비용 효율성 분석 (앞으로 이동) */}
                    {(() => {
                      // Filter out runs that appear in maxCostRuns from minCostRuns
                      const maxCostIds = new Set(stats.maxCostRuns.map(r => r.run_id));
                      const filteredMinCostRuns = stats.minCostRuns.filter(r => !maxCostIds.has(r.run_id));
                      
                      return (
                        <CostEfficiencySection
                          avgCost={stats.summary.avgCostPerRun}
                          avgTokens={stats.summary.avgTokenPerRun}
                          minCostRuns={filteredMinCostRuns}
                          maxCostRuns={stats.maxCostRuns}
                          onNavigateToLog={handleNavigateToLog}
                        />
                      );
                    })()}

                    {/* 2. 실행 추이 차트 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-500" />
                        실행 추이 (최근 30일)
                      </h3>
                      <div className="h-[300px]">
                        <RunsOverTimeChart data={runsOverTimeData} />
                      </div>
                    </div>

                    {/* 3. 요약 정보 (StatisticsCards) */}
                    <StatisticsCards stats={stats.summary} />

                    {/* 4. 최근 실패 사례 */}
                    {stats.recentFailures.length > 0 && (
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          최근 실패 사례 (Live)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-red-50/50">
                              <tr>
                                <th className="px-4 py-3">발생 시간</th>
                                <th className="px-4 py-3">실패 노드</th>
                                <th className="px-4 py-3">에러 메시지</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {stats.recentFailures.map((fail) => {
                                const nodeDisplay = getNodeDisplayInfo(fail.node_id);
                                return (
                                <tr
                                  key={fail.run_id}
                                  onClick={() => handleNavigateToLog(fail.run_id)}
                                  className="hover:bg-red-50/30 cursor-pointer transition-colors group"
                                >
                                  <td className="px-4 py-3 text-gray-600 group-hover:text-red-700">
                                    {format(new Date(fail.failed_at), 'MM-dd HH:mm:ss')}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${nodeDisplay.color}`}>
                                      {nodeDisplay.icon}
                                      {nodeDisplay.label}
                                    </span>
                                  </td>
                                  <td
                                    className="px-4 py-3 text-red-600 break-all max-w-xs truncate"
                                    title={fail.error_message}
                                  >
                                    {fail.error_message}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 5. 실패 원인 분석 */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        실패 원인 분석 (Top 5 Nodes)
                      </h3>
                      <FailureAnalysis failures={failureData} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
