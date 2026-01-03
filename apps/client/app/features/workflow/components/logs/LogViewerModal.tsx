import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft } from 'lucide-react';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { LogList } from './LogList';
import { LogDetail } from './LogDetail';
import { LogSummarySection } from './LogSummarySection';
import { LogFilterBar, LogFilters } from './LogFilterBar';
import { LogDetailComparisonModal } from './LogDetailComparisonModal';
import { LogCompareSelectionModal } from './LogCompareSelectionModal';
import { LogABTestBar } from './LogABTestBar';

interface LogViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  initialRunId?: string | null;
  onBack?: () => void;
}

export const LogViewerModal = ({ isOpen, onClose, workflowId, initialRunId, onBack }: LogViewerModalProps) => {
  const [logs, setLogs] = useState<WorkflowRun[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<WorkflowRun[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkflowRun | null>(null);
  const [compareLog, setCompareLog] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  // View Mode: 'list' | 'detail' | 'compare'
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'compare'>('list');

  // A/B Test State
  const [isABTestOpen, setIsABTestOpen] = useState(false);
  const [abRunA, setABRunA] = useState<WorkflowRun | null>(null);
  const [abRunB, setABRunB] = useState<WorkflowRun | null>(null);
  const [selectionTarget, setSelectionTarget] = useState<'A' | 'B' | null>(null);

  // Compare Modal State (Legacy/Button trigger)
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  
  const abSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Auto-scroll to A/B Section when opened
  useEffect(() => {
      if (isABTestOpen && abSectionRef.current) {
          setTimeout(() => {
              abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
      }
  }, [isABTestOpen]);

  // Load logs on open
  useEffect(() => {
    if (workflowId) {
      loadLogs(); // Always load list for context

      if (initialRunId) {
         // Direct navigation to specific run
         fetchAndSelectRun(initialRunId);
      } else {
         // Normal open
         setViewMode('list');
         setSelectedLog(null);
      }

      setCompareLog(null);
      // Reset A/B state
      setIsABTestOpen(false);
      setABRunA(null);
      setABRunB(null);
      setSelectionTarget(null);
    }
  }, [workflowId, initialRunId]); 

  const fetchAndSelectRun = async (runId: string) => {
      try {
           const run = await workflowApi.getWorkflowRun(workflowId, runId);
           setSelectedLog(run);
           setViewMode('detail');
      } catch (err) {
          console.error("Failed to fetch initial run:", err);
          setViewMode('list'); 
      }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await workflowApi.getWorkflowRuns(workflowId, page);
      setLogs(response.items);
      setFilteredLogs(response.items);
    } catch (error) {
      console.error("Failed to load workflow runs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filters: LogFilters) => {
    let result = [...logs];

    if (filters.status !== 'all') {
      result = result.filter(log => log.status === filters.status);
    }

    if (filters.dateRange.start) {
      result = result.filter(log => new Date(log.started_at) >= filters.dateRange.start!);
    }
    if (filters.dateRange.end) {
      result = result.filter(log => new Date(log.started_at) <= filters.dateRange.end!);
    }

    setFilteredLogs(result);
  };

  const handleLogSelect = (log: WorkflowRun) => {
    // 1. A/B Selection Mode
    if (selectionTarget === 'A') {
      if (abRunB?.id === log.id) {
        alert("이미 B(비교군)로 선택된 실행입니다. 다른 실행을 선택해주세요.");
        return;
      }
      setABRunA(log);
      setSelectionTarget(null);
      
      // Auto-scroll if both are now selected
      if (abRunB) {
          setTimeout(() => {
              abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
      }
      return;
    }
    if (selectionTarget === 'B') {
      if (abRunA?.id === log.id) {
        alert("이미 A(기준)로 선택된 실행입니다. 다른 실행을 선택해주세요.");
        return;
      }
      setABRunB(log);
      setSelectionTarget(null);

      // Auto-scroll if both are now selected
      if (abRunA) {
          setTimeout(() => {
              abSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
      }
      return;
    }

    // 2. Default Navigation
    setSelectedLog(log);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    // If onBack is provided (e.g. return to Monitoring), use it
    if (onBack) {
        onBack();
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

  const stats = {
    totalRuns: logs.length,
    successCount: logs.filter(l => l.status === 'success').length || 0,
    failureCount: logs.filter(l => l.status === 'failed').length || 0,
    avgDuration: logs.reduce((acc, curr) => acc + (curr.duration || 0), 0) / (logs.length || 1)
  };
  
  if (!isOpen || !mounted) return null;

  return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">
                    {/* Header */}
                    {viewMode !== 'compare' && (
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                        <div className="flex items-center gap-3">
                            {viewMode === 'detail' && (
                                <button 
                                    onClick={handleBackToList}
                                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <h2 className="text-xl font-bold text-gray-800">
                                {viewMode === 'list' ? '워크플로우 실행 기록' : '실행 상세 정보'}
                            </h2>
                        </div>
                        {onClose && (
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        )}
                        </div>
                    )}


                    {/* Content Body */}
                    <div className="flex-1 overflow-hidden bg-gray-50">
                        
                        {/* VIEW: LIST MODE */}
                        {viewMode === 'list' && (
                            <div className="h-full max-w-4xl mx-auto p-6 overflow-y-auto scroll-smooth pb-20 block">
                                {/* ... (Summary, Filter, A/B Bar same as before) */}
                                <LogSummarySection {...stats} />

                                <LogFilterBar 
                                    onFilterChange={handleFilterChange} 
                                    availableVersions={[]} 
                                />

                                <div ref={abSectionRef} className="scroll-mt-4 transition-all duration-300 mb-4">
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

                                {/* 4. Log List */}
                                <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm relative min-h-[400px]">
                                    {/* Selection Overlay */}
                                    {selectionTarget && (
                                        <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-2 z-20 opacity-95 shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                            <span>👇 목록에서 </span>
                                            <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full">Run {selectionTarget}</span>
                                            <span> 로 사용할 실행 기록을 클릭하세요</span>
                                        </div>
                                    )}

                                    {loading && logs.length === 0 ? (
                                        <div className="p-12 text-center text-gray-400">로그를 불러오는 중입니다...</div>
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
                                    
                                    {filteredLogs.length === 0 && !loading && (
                                        <div className="p-12 text-center text-gray-400">
                                            필터 조건에 맞는 로그가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* VIEW: DETAIL MODE */}
                        {viewMode === 'detail' && selectedLog && (
                            <div className="h-full w-full bg-white overflow-hidden flex flex-col">
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

                    {/* OLD Comparison Selection Modal (Still used for Detail page trigger) */}
                    <LogCompareSelectionModal
                        isOpen={isCompareModalOpen}
                        onClose={() => setIsCompareModalOpen(false)}
                        onSelect={handleCompareSelect}
                        currentRunId={selectedLog?.id || ''}
                        logs={logs} 
                    />

                </div>
            </div>
        </div>,
        document.body
    );
};
