import {
  DollarSign,
  Zap,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  MousePointerClick,
} from 'lucide-react';
import { RunCostStat } from '@/app/features/workflow/types/Api';
import { format } from 'date-fns';

interface CostEfficiencySectionProps {
  totalCost: number;
  avgCost: number;
  avgTokens: number;
  minCostRuns: RunCostStat[];
  maxCostRuns: RunCostStat[];
  onNavigateToLog: (runId: string) => void;
}

export const CostEfficiencySection = ({
  totalCost,
  avgCost,
  avgTokens,
  minCostRuns,
  maxCostRuns,
  onNavigateToLog,
}: CostEfficiencySectionProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Coins className="w-5 h-5 text-gray-500" />
          비용 사용 현황
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> 총 비용
            </span>
            <span className="text-2xl font-bold text-gray-900">
              ${totalCost.toFixed(4)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
              <Coins className="w-3 h-3" /> 평균 비용
            </span>
            <span className="text-2xl font-bold text-gray-900">
              ${avgCost.toFixed(4)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3" /> 평균 토큰
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {avgTokens.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Max Cost Top 3 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-red-500" />
              최다 비용 발생 (Top 3)
            </h4>
            <div className="space-y-2">
              {maxCostRuns.map((run) => (
                <button
                  key={run.run_id}
                  onClick={() => onNavigateToLog(run.run_id)}
                  className="w-full text-left bg-gray-50 hover:bg-white hover:border-gray-300 border border-gray-200 p-3 rounded-lg transition-colors group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">
                      {format(new Date(run.started_at), 'MM-dd HH:mm')}
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      ${run.total_cost.toFixed(8)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <span className="flex items-center gap-1 justify-end">
                      토큰: {run.total_tokens.toLocaleString()}
                      <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                </button>
              ))}
              {maxCostRuns.length === 0 && (
                <p className="text-sm text-gray-400 italic">데이터 없음</p>
              )}
            </div>
          </div>

          {/* Min Cost Top 3 */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-green-500" />
              최소 비용 발생 (Top 3)
            </h4>
            <div className="space-y-2">
              {minCostRuns.map((run) => (
                <button
                  key={run.run_id}
                  onClick={() => onNavigateToLog(run.run_id)}
                  className="w-full text-left bg-gray-50 hover:bg-white hover:border-gray-300 border border-gray-200 p-3 rounded-lg transition-colors group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-500">
                      {format(new Date(run.started_at), 'MM-dd HH:mm')}
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      ${run.total_cost.toFixed(8)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <span className="flex items-center gap-1 justify-end">
                      토큰: {run.total_tokens.toLocaleString()}
                      <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                </button>
              ))}
              {minCostRuns.length === 0 && (
                <p className="text-sm text-gray-400 italic">데이터 없음</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
