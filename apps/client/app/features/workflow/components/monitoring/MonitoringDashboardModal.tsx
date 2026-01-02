import { useState, useEffect } from 'react';
import { X, Clock, Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import { StatisticsCards } from './StatisticsCards';
import { RunsOverTimeChart } from './charts/RunsOverTimeChart';
import { CostAnalysisChart } from './charts/CostAnalysisChart';
import { FailureAnalysis } from './FailureAnalysis';
import { workflowApi } from '@/app/features/workflow/api/workflowApi'; // [NEW] API 연동

interface MonitoringDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
}

import { DashboardStats } from '@/app/features/workflow/types/Api';

import { createPortal } from 'react-dom';

// ... (existing imports)

export const MonitoringDashboardModal = ({ isOpen, onClose, workflowId }: MonitoringDashboardModalProps) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[85vh] h-auto flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()} // 내부 클릭 시 닫힘 방지
      >
        
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
             <TrendingUp className="w-6 h-6 text-blue-600" />
             <h2 className="text-xl font-bold text-gray-800">모니터링 대시보드</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 바디 (스크롤 가능 영역) */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* 1. 통계 카드 섹션 */}
            {loading || !stats ? (
                <div className="h-32 flex items-center justify-center bg-gray-100 rounded-xl animate-pulse">
                    <span className="text-gray-400">Loading statistics...</span>
                </div>
            ) : (
                <>
                    <StatisticsCards stats={stats.summary} />

                    {/* 2. 메인 차트 그리드 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-gray-500" />
                            실행 추이 (최근 7일)
                        </h3>
                        <div className="h-[300px]">
                            <RunsOverTimeChart data={stats.runsOverTime} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            비용 및 토큰 사용량
                        </h3>
                        <div className="h-[300px]">
                            <CostAnalysisChart data={stats.costAnalysis} />
                        </div>
                    </div>
                    </div>

                    {/* 3. 실패 원인 분석 (하단 와이드 섹션) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            실패 원인 분석 (자주 실패하는 노드)
                        </h3>
                        <FailureAnalysis failures={stats.failureAnalysis} />
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
