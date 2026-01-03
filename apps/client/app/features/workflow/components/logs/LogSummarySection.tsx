import { TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface LogSummarySectionProps {
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDuration: number;
}

export const LogSummarySection = ({ totalRuns, successCount, failureCount, avgDuration }: LogSummarySectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* 1. 총 실행 횟수 */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-blue-600 mb-2">
          <TrendingUp className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Total Runs</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {totalRuns}
        </div>
      </div>

      {/* 2. 성공 횟수 */}
      <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Successful</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {successCount}
        </div>
      </div>

      {/* 3. 실패 횟수 */}
      <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-red-600 mb-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Failed</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {failureCount}
        </div>
      </div>

      {/* 4. 평균 소요 시간 */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col justify-between">
        <div className="flex items-center gap-2 text-gray-600 mb-2">
          <Clock className="w-5 h-5" />
          <span className="text-sm font-bold uppercase">Avg Duration</span>
        </div>
        <div className="text-3xl font-extrabold text-gray-800">
          {avgDuration.toFixed(2)}<span className="text-sm font-medium text-gray-500 ml-1">sec</span>
        </div>
      </div>
    </div>
  );
};
