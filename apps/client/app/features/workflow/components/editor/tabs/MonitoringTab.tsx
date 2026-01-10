'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

import { workflowApi } from '@/app/features/workflow/api/workflowApi';
import { DashboardStatsResponse } from '@/app/features/workflow/types/Api';
import { StatisticsCards } from '@/app/features/workflow/components/monitoring/StatisticsCards';
import { RunsOverTimeChart } from '@/app/features/workflow/components/monitoring/charts/RunsOverTimeChart';
import { CostEfficiencySection } from '@/app/features/workflow/components/monitoring/CostEfficiencySection';
import { FailureAnalysis } from '@/app/features/workflow/components/monitoring/FailureAnalysis';
import { getNodeDisplayInfo } from '@/app/features/workflow/utils/nodeDisplayUtils';

interface MonitoringTabProps {
  workflowId: string;
  onNavigateToLog: (runId: string) => void;
}

export const MonitoringTab = ({
  workflowId,
  onNavigateToLog,
}: MonitoringTabProps) => {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  // Ref for scroll restoration if needed (though usually we just scroll top on mount)
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (workflowId) {
      loadStats();
    }
  }, [workflowId]);

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
    // Navigate to log detail via parent callback
    onNavigateToLog(runId);
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

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-y-auto bg-gray-100 p-6 scroll-smooth animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        {monitoringLoading || !stats ? (
          <div className="h-64 flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 animate-pulse">
            <TrendingUp className="w-8 h-8 text-gray-300 mb-2" />
            <span className="text-gray-400 font-medium">
              실시간 통계 분석 중...
            </span>
          </div>
        ) : (
          <>
            {/* 1. 비용 효율성 분석 */}
            {(() => {
              // Filter out runs that appear in maxCostRuns from minCostRuns
              const maxCostIds = new Set(
                stats.maxCostRuns.map((r) => r.run_id),
              );
              const filteredMinCostRuns = stats.minCostRuns.filter(
                (r) => !maxCostIds.has(r.run_id),
              );

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
                              {format(
                                new Date(fail.failed_at),
                                'MM-dd HH:mm:ss',
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm font-medium ${nodeDisplay.color}`}
                              >
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
  );
};
