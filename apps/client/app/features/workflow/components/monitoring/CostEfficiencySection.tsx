import { DollarSign, Zap, ArrowUpRight, ArrowDownRight, MousePointerClick } from 'lucide-react';
import { RunCostStat } from '@/app/features/workflow/types/Api';
import { format } from 'date-fns';

interface CostEfficiencySectionProps {
  avgCost: number;
  avgTokens: number;
  minCostRuns: RunCostStat[];
  maxCostRuns: RunCostStat[];
  onNavigateToLog: (runId: string) => void;
}

export const CostEfficiencySection = ({ 
  avgCost, 
  avgTokens, 
  minCostRuns, 
  maxCostRuns,
  onNavigateToLog
}: CostEfficiencySectionProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          비용 효율성 분석
        </h3>
      </div>
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Averages */}
        <div className="space-y-6">
          <div className="bg-amber-50/50 p-6 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-700 uppercase mb-1">평균 비용 / Run</p>
              <h4 className="text-3xl font-bold text-gray-900">${avgCost.toFixed(8)}</h4>
            </div>
            <div className="p-3 bg-white rounded-full shadow-sm">
               <DollarSign className="w-6 h-6 text-amber-500" />
            </div>
          </div>
          
          <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700 uppercase mb-1">평균 토큰 / Run</p>
              <h4 className="text-3xl font-bold text-gray-900">{avgTokens.toLocaleString()} <span className="text-lg font-normal text-gray-500">tokens</span></h4>
            </div>
             <div className="p-3 bg-white rounded-full shadow-sm">
               <Zap className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Right: Extremes Lists */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Max Cost Top 3 */}
            <div>
                 <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                    최다 비용 발생 (Top 3)
                 </h4>
                 <div className="space-y-2">
                    {maxCostRuns.map(run => (
                        <button 
                            key={run.run_id}
                            onClick={() => onNavigateToLog(run.run_id)}
                            className="w-full text-left bg-gray-50 hover:bg-red-50 hover:border-red-200 border border-transparent p-3 rounded-lg transition-all group"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500">{format(new Date(run.started_at), 'MM-dd HH:mm')}</span>
                                <span className="text-sm font-bold text-red-600">${run.total_cost.toFixed(8)}</span>
                            </div>
                            <div className="text-xs text-gray-400 text-right">
                                <span className="flex items-center gap-1 justify-end">
                                    토큰: {run.total_tokens.toLocaleString()}
                                    <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                            </div>
                        </button>
                    ))}
                    {maxCostRuns.length === 0 && <p className="text-sm text-gray-400 italic">데이터 없음</p>}
                 </div>
            </div>

            {/* Min Cost Top 3 */}
            <div>
                 <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                    최소 비용 발생 (Top 3)
                 </h4>
                 <div className="space-y-2">
                    {minCostRuns.map(run => (
                        <button 
                            key={run.run_id}
                            onClick={() => onNavigateToLog(run.run_id)}
                            className="w-full text-left bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-transparent p-3 rounded-lg transition-all group"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-gray-500">{format(new Date(run.started_at), 'MM-dd HH:mm')}</span>
                                <span className="text-sm font-bold text-green-600">${run.total_cost.toFixed(8)}</span>
                            </div>
                            <div className="text-xs text-gray-400 text-right">
                                <span className="flex items-center gap-1 justify-end">
                                    토큰: {run.total_tokens.toLocaleString()}
                                    <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                            </div>
                        </button>
                    ))}
                    {minCostRuns.length === 0 && <p className="text-sm text-gray-400 italic">데이터 없음</p>}
                 </div>
            </div>

        </div>
      </div>
    </div>
  );
};
