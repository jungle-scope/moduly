import { Activity, CheckCircle2, DollarSign, Timer } from 'lucide-react';

interface StatisticsCardsProps {
  stats: {
    totalRuns: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
  };
}

export const StatisticsCards = ({ stats }: StatisticsCardsProps) => {
  const cards = [
    {
      label: '총 실행 수',
      value: stats.totalRuns.toLocaleString(),
      subValue: '지난 30일',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: '성공률',
      value: `${stats.successRate}%`,
      subValue: '안정적',
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '평균 소요시간',
      value: `${stats.avgLatency}s`,
      subValue: '최적화 양호',
      icon: Timer,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: '총 비용',
      value: `$${stats.totalCost.toFixed(2)}`,
      subValue: '예상 범위 내',
      icon: DollarSign,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${card.bg}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            {/* <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-500">
               {card.subValue}
            </span> */}
          </div>
          <div>
            <p className="text-سم text-gray-500 font-medium mb-1">{card.label}</p>
            <h3 className="text-2xl font-bold text-gray-900">{card.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};
