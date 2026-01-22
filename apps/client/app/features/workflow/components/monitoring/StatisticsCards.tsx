import { TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import { StatsSummary } from '@/app/features/workflow/types/Api';

interface StatisticsCardsProps {
  stats: StatsSummary;
}

export const StatisticsCards = ({ stats }: StatisticsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 1. 총 실행 횟수 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 font-medium">총 실행</span>
          <div className="p-2 bg-blue-50 rounded-lg">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {stats.totalRuns.toLocaleString()}
        </div>
        <p className="text-sm text-gray-400 mt-1">Total Runs</p>
      </div>

      {/* 2. 성공률 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 font-medium">성공률</span>
          <div className="p-2 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {stats.successRate}%
        </div>
        <p className="text-sm text-gray-400 mt-1">Success Rate</p>
      </div>

      {/* 3. 평균 소요 시간 */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-500 font-medium">평균 소요 시간</span>
          <div className="p-2 bg-purple-50 rounded-lg">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {stats.avgDuration.toFixed(2)}
          <span className="text-sm font-medium text-gray-400 ml-1">초</span>
        </div>
        <p className="text-sm text-gray-400 mt-1">Avg Time</p>
      </div>
    </div>
  );
};
