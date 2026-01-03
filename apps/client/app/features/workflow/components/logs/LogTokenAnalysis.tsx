import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { BarChart, Coins, Zap } from 'lucide-react';

interface LogTokenAnalysisProps {
  run: WorkflowRun;
}

export const LogTokenAnalysis = ({ run }: LogTokenAnalysisProps) => {
  const nodeRuns = run.node_runs || [];

  // 1. Calculate By Node
  const usageByNode = nodeRuns
    .filter((n) => (n.outputs as any)?.usage?.total_tokens)
    .map((n) => {
      const usage = (n.outputs as any).usage;
      const cost = (n.outputs as any).cost || 0;
      return {
        nodeId: n.node_id,
        nodeType: n.node_type,
        model: (n.outputs as any).model || 'Unknown',
        totalTokens: usage.total_tokens || 0,
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        cost,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens); // Scarcity first

  // 2. Calculate By Model
  const usageByModel = usageByNode.reduce(
    (acc, curr) => {
      const model = curr.model;
      if (!acc[model]) {
        acc[model] = {
            model,
            totalTokens: 0,
            cost: 0,
            count: 0
        };
      }
      acc[model].totalTokens += curr.totalTokens;
      acc[model].cost += curr.cost;
      acc[model].count += 1;
      return acc;
    },
    {} as Record<string, { model: string; totalTokens: number; cost: number; count: number }>,
  );

  const modelStats = Object.values(usageByModel).sort((a, b) => b.totalTokens - a.totalTokens);

  // If no usage data, don't render anything
  if (usageByNode.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-in slide-in-from-top-2 duration-300">
      
      {/* Section 1: Usage by LLM Node */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <Zap className="w-4 h-4 text-amber-500" />
            <h4 className="font-semibold text-gray-800 text-sm">LLM 노드별 토큰 사용량</h4>
        </div>
        <div className="space-y-3">
            {usageByNode.map((node) => (
                <div key={node.nodeId} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[150px]" title={node.nodeId}>
                            {node.nodeType} <span className="text-gray-400 font-normal">({node.nodeId})</span>
                        </span>
                        <span className="font-bold text-gray-900">{node.totalTokens.toLocaleString()} tks</span>
                    </div>
                    {/* Progress Bar-like visualization could go here */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-amber-400 h-full rounded-full" 
                            style={{ width: `${Math.min((node.totalTokens / (modelStats[0]?.totalTokens || 1)) * 100, 100)}%` }} // Relative to max for scale
                        ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{node.model}</span>
                        <span>${node.cost.toFixed(5)}</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Section 2: Usage by Model */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
            <BarChart className="w-4 h-4 text-blue-500" />
            <h4 className="font-semibold text-gray-800 text-sm">모델별 토큰 사용량</h4>
        </div>
        <div className="space-y-3">
             {modelStats.map((stat) => (
                <div key={stat.model} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-gray-700">{stat.model}</span>
                        <div className="text-right">
                             <div className="font-bold text-gray-900">{stat.totalTokens.toLocaleString()} tks</div>
                        </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-blue-500 h-full rounded-full" 
                            style={{ width: `${Math.min((stat.totalTokens / (modelStats[0].totalTokens || 1)) * 100, 100)}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{stat.count} calls</span>
                        <span className="font-medium text-gray-700">${stat.cost.toFixed(5)}</span>
                    </div>
                </div>
            ))}
        </div>
      </div>

    </div>
  );
};
