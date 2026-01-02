import { TrendingUp, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { StatsSummary } from '@/app/features/workflow/types/Api';

interface StatisticsCardsProps {
  stats: StatsSummary;
}

export const StatisticsCards = ({ stats }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* 1. 총 실행 횟수 */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">총 실행 (Total Runs)</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {stats.totalRuns.toLocaleString()}
        </div>
      </div>

      {/* 2. 성공률 */}
      <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">성공률 (Success Rate)</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {stats.successRate}%
        </div>
      </div>

      {/* 3. 평균 소요 시간 */}
      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-purple-600 mb-2">
          <Clock className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">평균 소요 시간 (Avg Time)</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {stats.avgDuration.toFixed(2)}<span className="text-sm font-medium text-gray-500 ml-1">초</span>
        </div>
      </div>

      {/* 4. 총 비용 */}
      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-amber-600 mb-2">
          <DollarSign className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">총 비용 (Total Cost)</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          ${stats.totalCost.toFixed(4)}
        </div>
      </div>
    </div>
  );
};
