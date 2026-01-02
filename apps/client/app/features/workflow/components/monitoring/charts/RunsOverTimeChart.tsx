import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// const data = [ ... ]; // Remove hardcoded data

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-100 shadow-lg rounded-lg text-sm">
        <p className="font-bold text-gray-800 mb-1">{label}</p>
        <p className="text-blue-600 font-medium">실행 수: {data.runs}</p>
        {data.total_cost !== undefined && (
             <p className="text-amber-600">비용: ${data.total_cost.toFixed(4)}</p>
        )}
        {data.total_tokens !== undefined && (
             <p className="text-gray-500">토큰: {data.total_tokens.toLocaleString()}</p>
        )}
      </div>
    );
  }
  return null;
};

interface Props {
  data: { 
      name: string; 
      runs: number;
      total_cost?: number;
      total_tokens?: number;
  }[];
}

export const RunsOverTimeChart = ({ data }: Props) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="runs" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRuns)" />
      </AreaChart>
    </ResponsiveContainer>
  );
};
