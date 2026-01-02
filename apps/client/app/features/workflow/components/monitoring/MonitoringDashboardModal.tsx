import { useState, useEffect, useRef } from 'react';
import { X, Clock, Zap, AlertTriangle, TrendingUp, AlertCircle } from 'lucide-react';
import { StatisticsCards } from './StatisticsCards';
import { RunsOverTimeChart } from './charts/RunsOverTimeChart';
import { CostEfficiencySection } from './CostEfficiencySection';
import { FailureAnalysis } from './FailureAnalysis';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { DashboardStatsResponse } from '@/app/features/workflow/types/Api';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';

interface MonitoringDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  onNavigateToLog: (runId: string) => void;
  initialScrollTop?: number;
  onSaveScrollPos?: (pos: number) => void;
}

export const MonitoringDashboardModal = ({ 
  isOpen, 
  onClose, 
  workflowId, 
  onNavigateToLog,
  initialScrollTop = 0,
  onSaveScrollPos
}: MonitoringDashboardModalProps) => {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Restore scroll position
  useEffect(() => {
    if (isOpen && stats && scrollContainerRef.current) {
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = initialScrollTop;
            }
        }, 100);
    }
  }, [isOpen, stats, initialScrollTop]);

  // Save scroll position on unmount
  useEffect(() => {
      return () => {
          if (scrollContainerRef.current && onSaveScrollPos) {
              onSaveScrollPos(scrollContainerRef.current.scrollTop);
          }
      };
  }, [onSaveScrollPos]);

  useEffect(() => {
    if (isOpen && workflowId) {
        loadStats();
    }
  }, [isOpen, workflowId]);

  const loadStats = async () => {
    try {
        setLoading(true);
        const data = await workflowApi.getDashboardStats(workflowId);
        setStats(data);
    } catch (error) {
        console.error("Failed to load dashboard stats:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleNavigate = (runId: string) => {
      if (scrollContainerRef.current && onSaveScrollPos) {
          onSaveScrollPos(scrollContainerRef.current.scrollTop);
      }
      onClose();
      onNavigateToLog(runId);
  };

  if (!isOpen || !mounted) return null;

  // Chart Data Mapping
  const runsOverTimeData = stats?.runsOverTime.map(d => ({
      name: d.date,
      runs: d.count,
      total_cost: d.total_cost,
      total_tokens: d.total_tokens
  })) || [];

  const failureData = stats?.failureAnalysis.map(f => ({
      node: f.node_name,
      count: f.count,
      reason: f.reason,
      rate: f.rate
  })) || [];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] h-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2">
             <TrendingUp className="w-6 h-6 text-blue-600" />
             <h2 className="text-xl font-bold text-gray-800">모니터링 대시보드</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 바디 (스크롤 가능 영역) */}
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto bg-gray-50 p-6 scroll-smooth"
        >
          <div className="max-w-7xl mx-auto space-y-6 pb-10">
            
            {loading || !stats ? (
                <div className="h-64 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 animate-pulse">
                    <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
                    <span className="text-gray-400 font-medium">실시간 통계 분석 중...</span>
                </div>
            ) : (
                <>
                    {/* 1. 통계 카드 섹션 */}
                    <StatisticsCards stats={stats.summary} />

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

                    {/* 3. 비용 효율성 분석 (New) */}
                    <CostEfficiencySection 
                        avgCost={stats.summary.avgCostPerRun}
                        avgTokens={stats.summary.avgTokenPerRun}
                        minCostRuns={stats.minCostRuns}
                        maxCostRuns={stats.maxCostRuns}
                        onNavigateToLog={handleNavigate}
                    />

                    {/* 4. 최근 실패 사례 (Live) */}
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
                                            <th className="px-4 py-3">실행 ID</th>
                                            <th className="px-4 py-3">실패 노드</th>
                                            <th className="px-4 py-3">에러 메시지</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {stats.recentFailures.map((fail) => (
                                            <tr 
                                                key={fail.run_id} 
                                                onClick={() => handleNavigate(fail.run_id)}
                                                className="hover:bg-red-50/30 cursor-pointer transition-colors group"
                                            >
                                                <td className="px-4 py-3 text-gray-600 group-hover:text-red-700">
                                                    {format(new Date(fail.failed_at), 'MM-dd HH:mm:ss')}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500 group-hover:text-red-600">
                                                    {fail.run_id.slice(0, 8)}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    {fail.node_id}
                                                </td>
                                                <td className="px-4 py-3 text-red-600 break-all max-w-xs truncate" title={fail.error_message}>
                                                    {fail.error_message}
                                                </td>
                                            </tr>
                                        ))}
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

      </div>
    </div>,
    document.body
  );
};
