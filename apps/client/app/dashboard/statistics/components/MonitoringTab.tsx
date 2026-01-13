import { useGlobalStats } from '../hooks/useGlobalStats';
import { RunsOverTimeChart } from '@/app/features/workflow/components/monitoring/charts/RunsOverTimeChart';
import { getNodeDisplayInfo } from '@/app/features/workflow/utils/nodeDisplayUtils';
import {
  AlertCircle,
  Box,
  Coins,
  TrendingUp,
  Activity,
  ArrowRight,
  DollarSign,
  Zap,
  Layers,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export const MonitoringTab = () => {
  const { stats, loading } = useGlobalStats();
  const router = useRouter();

  if (loading || !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-500">
            전체 서비스 통계를 취합하는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  // Chart Data format mapping
  const chartData = stats.runsOverTime.map((d) => ({
    name: d.date,
    runs: d.count,
    total_cost: d.total_cost,
    total_tokens: d.total_tokens,
  }));

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* 상단 2/3: Global Summary */}
      <div className="flex-none space-y-6">
        {/* 1. Key Metrics Cards (Overall) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Service Count */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">서비스 개수</span>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Box className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalServices}
            </div>
            <p className="text-sm text-gray-400 mt-1">운영 중인 워크플로우</p>
          </div>

          {/* Total Tokens */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">
                전체 토큰 사용량
              </span>
              <div className="p-2 bg-purple-50 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {stats.totalTokens.toLocaleString()}
            </div>
            <p className="text-sm text-gray-400 mt-1">Total Tokens</p>
          </div>

          {/* Total Cost */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 font-medium">전체 비용</span>
              <div className="p-2 bg-green-50 rounded-lg">
                <Coins className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${stats.totalCost.toFixed(4)}
            </div>
            <p className="text-sm text-gray-400 mt-1">Total Cost</p>
          </div>
        </div>

        {/* 2. Month Expenditure Summary (Moved Up) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Coins className="w-5 h-5 text-gray-500" />
            이번 달 지출 요약
          </h3>

          {/* 2-1. This Month Summary Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> 이번 달 총 비용
              </span>
              <span className="text-2xl font-bold text-gray-900">
                ${stats.thisMonthTotals.cost.toFixed(4)}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> 이번 달 총 토큰
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {stats.thisMonthTotals.tokens.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3" /> 실행된 서비스
              </span>
              <span className="text-2xl font-bold text-gray-900">
                {stats.thisMonthTotals.activeServices}
              </span>
            </div>
          </div>

          {/* 2-2. Top 3 Expensive Models List (NEW) */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Box className="w-4 h-4 text-gray-500" />
              Top 3 지출 모델
            </h4>
            <div className="space-y-3">
              {stats.topExpensiveModels &&
              stats.topExpensiveModels.length > 0 ? (
                stats.topExpensiveModels.map((model, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          {model.model_name}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                          {model.provider_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {model.total_tokens.toLocaleString()} tokens
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      ${model.total_cost.toFixed(4)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-gray-400 py-2">
                  사용된 모델이 없습니다.
                </div>
              )}
            </div>
          </div>

          {/* 2-3. Top 3 Expensive Services Cards */}
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            Top 3 지출 서비스
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.top3Expensive?.map((service) => (
              <div
                key={service.id}
                className="p-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-col gap-3 relative overflow-hidden"
              >
                {/* No Rank Badge */}

                <div
                  className="font-bold text-gray-900 truncate cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() =>
                    router.push(`/modules/${service.id}?tab=monitoring`)
                  }
                >
                  {service.name}
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">지출 비용</span>
                    <span className="font-bold text-gray-900">
                      ${service.cost.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">사용 토큰</span>
                    <span className="font-medium text-gray-700">
                      {service.tokens.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">실행 횟수</span>
                    <span className="font-medium text-gray-700">
                      {service.runs.toLocaleString()}회
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {(!stats.top3Expensive || stats.top3Expensive.length === 0) && (
              <div className="col-span-3 text-center py-8 text-gray-400 text-sm">
                이번 달 실행 기록이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 3. Main Graph: Global Trends */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-500" />
            통합 실행 추이
          </h3>
          <div className="h-[300px] w-full">
            <RunsOverTimeChart data={chartData} />
          </div>
        </div>
      </div>

      {/* 하단 1/3: Service List */}
      <div className="flex-none bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">서비스 목록</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.services.map((service) => (
            <div
              key={service.id}
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() =>
                router.push(`/modules/${service.id}?tab=monitoring`)
              }
            >
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {service.name}
                </h4>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
              </div>

              {service.stats ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">실행 수</span>
                    <span className="font-medium">
                      {service.stats.summary.totalRuns.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">성공률</span>
                    <span
                      className={`font-medium ${
                        service.stats.summary.successRate >= 90
                          ? 'text-green-600'
                          : service.stats.summary.successRate >= 70
                            ? 'text-orange-600'
                            : 'text-red-600'
                      }`}
                    >
                      {service.stats.summary.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">평균 토큰</span>
                    <span className="font-medium">
                      {Math.round(
                        service.stats.summary.avgTokenPerRun,
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">평균 비용</span>
                    <span className="font-medium">
                      ${service.stats.summary.avgCostPerRun.toFixed(5)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-4">데이터 없음</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Recent Failures (User Scoped) - Moved to Bottom */}
      {stats.recentFailures.length > 0 ? (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            최근 실패 사례 (전체 서비스)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">발생 시간</th>
                  <th className="px-4 py-3">서비스명</th>
                  <th className="px-4 py-3">실패 노드</th>
                  <th className="px-4 py-3 rounded-r-lg">에러 메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentFailures.map((fail) => {
                  const nodeDisplay = getNodeDisplayInfo(fail.node_id);
                  return (
                    <tr
                      key={fail.run_id + fail.node_id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(
                          `/modules/${fail.workflow_id}?tab=logs&runId=${fail.run_id}`,
                        )
                      }
                    >
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(fail.failed_at), 'MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {fail.workflow_name}
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
                        className="px-4 py-3 text-red-600 truncate max-w-xs"
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
      ) : null}
    </div>
  );
};
