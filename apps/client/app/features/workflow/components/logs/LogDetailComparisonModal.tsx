import { useState } from 'react';
import { LogDetail } from './LogDetail';
import { WorkflowRun } from '../../types/Api';
import { ArrowLeft, ArrowRight, X, Minus, Plus, TrendingDown, TrendingUp, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { getNodeDisplayInfo } from '../../utils/nodeDisplayUtils';

interface LogDetailComparisonModalProps {
    runA: WorkflowRun;
    runB: WorkflowRun;
    onBack: () => void;
}

export const LogDetailComparisonModal = ({ runA, runB, onBack }: LogDetailComparisonModalProps) => {

    // Helper to calculate totals safely
    const calculateStats = (run: WorkflowRun) => {
        const totalTokens = run.total_tokens || 
            (run.node_runs || []).reduce((acc, node) => acc + ((node.outputs as any)?.usage?.total_tokens || 0), 0);
        
        const totalCost = run.total_cost || 
            (run.node_runs || []).reduce((acc, node) => acc + ((node.outputs as any)?.cost || 0), 0);

        return { totalTokens, totalCost };
    };

    const statsA = calculateStats(runA);
    const statsB = calculateStats(runB);

    // Diffs (B - A)
    const durationDiff = (runB.duration || 0) - (runA.duration || 0);
    const tokenDiff = statsB.totalTokens - statsA.totalTokens;
    const costDiff = statsB.totalCost - statsA.totalCost;

    const renderDiffBadge = (val: number, type: 'duration' | 'token' | 'cost') => {
        if (val === 0) return <span className="text-gray-400 text-xs">-</span>;
        
        const isPositive = val > 0;
        // Cost/Token: Lower is better (Green if negative)
        // Duration: Lower is better (Green if negative)
        // So positive (Increase) is usually bad (Red), Negative (Decrease) is good (Green).
        // Except if tokens increase implies "Result Quality" increase? Usually efficiency view assumes lower is better.
        
        const isBad = isPositive; 
        const colorClass = isBad ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50';
        const Icon = isBad ? TrendingUp : TrendingDown;

        let displayVal = '';
        if (type === 'cost') displayVal = `$${Math.abs(val).toFixed(6)}`;
        else if (type === 'duration') displayVal = `${Math.abs(val).toFixed(2)}s`;
        else displayVal = Math.abs(val).toLocaleString();

        return (
            <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded ${colorClass}`}>
                {isPositive ? '+' : '-'}{displayVal} <Icon className="w-3 h-3" />
            </span>
        );
    };

    const [isSummaryOpen, setIsSummaryOpen] = useState(true);

    return (
        <div className="flex flex-col h-full bg-gray-50">
             {/* Header with Summary */}
             <div className="bg-white border-b border-gray-200 shadow-sm z-20">
                <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                ⚡ 실행 비교 분석
                                <span className="text-xs font-mono font-normal text-gray-400">
                                    {runA.id.slice(0,6)} vs {runB.id.slice(0,6)}
                                </span>
                            </h2>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setIsSummaryOpen(!isSummaryOpen)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                        {isSummaryOpen ? '요약 접기' : '요약 보기'}
                        {isSummaryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>

                {/* Summary Table */}
                {isSummaryOpen && (
                    <div className="px-6 py-4 bg-gray-50/50 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 w-1/4">항목</th>
                                        <th className="px-4 py-3 w-1/4">실행 A (기준)</th>
                                        <th className="px-4 py-3 w-1/4">실행 B (비교군)</th>
                                        <th className="px-4 py-3 w-1/4">차이</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {/* 1. Duration */}
                                    <tr>
                                        <td className="px-4 py-3 font-medium text-gray-700">소요 시간</td>
                                        <td className="px-4 py-3">{runA.duration?.toFixed(2)}s</td>
                                        <td className="px-4 py-3">{runB.duration?.toFixed(2)}s</td>
                                        <td className="px-4 py-3">{renderDiffBadge(durationDiff, 'duration')}</td>
                                    </tr>
                                    {/* 2. Tokens */}
                                    <tr>
                                        <td className="px-4 py-3 font-medium text-gray-700">총 토큰 사용량</td>
                                        <td className="px-4 py-3">{statsA.totalTokens.toLocaleString()}</td>
                                        <td className="px-4 py-3">{statsB.totalTokens.toLocaleString()}</td>
                                        <td className="px-4 py-3">{renderDiffBadge(tokenDiff, 'token')}</td>
                                    </tr>
                                    {/* 3. Cost */}
                                    <tr>
                                        <td className="px-4 py-3 font-medium text-gray-700">총 비용</td>
                                        <td className="px-4 py-3 text-amber-600">${statsA.totalCost.toFixed(6)}</td>
                                        <td className="px-4 py-3 text-amber-600">${statsB.totalCost.toFixed(6)}</td>
                                        <td className="px-4 py-3">{renderDiffBadge(costDiff, 'cost')}</td>
                                    </tr>
                                    {/* 4. Version */}
                                    <tr>
                                        <td className="px-4 py-3 font-medium text-gray-700">실행 버전</td>
                                        <td className="px-4 py-3">
                                            {runA.workflow_version ? (
                                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold border border-indigo-100">v{runA.workflow_version}</span>
                                            ) : <span className="text-gray-400 text-xs">Draft</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {runB.workflow_version ? (
                                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold border border-indigo-100">v{runB.workflow_version}</span>
                                            ) : <span className="text-gray-400 text-xs">Draft</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-400">-</td>
                                    </tr>
                                    {/* 5. Status */}
                                    {(runA.status === 'failed' || runB.status === 'failed') && (
                                         <tr className="bg-red-50/30">
                                             <td className="px-4 py-3 font-medium text-red-700">상태</td>
                                             <td className="px-4 py-3">
                                                 {runA.status === 'failed' ? (
                                                     <span className="text-red-600 font-bold text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> 실패</span>
                                                 ) : <span className="text-green-600 text-xs">성공</span>}
                                             </td>
                                             <td className="px-4 py-3">
                                                 {runB.status === 'failed' ? (
                                                     <span className="text-red-600 font-bold text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> 실패</span>
                                                 ) : <span className="text-green-600 text-xs">성공</span>}
                                             </td>
                                             <td className="px-4 py-3"></td>
                                         </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
             </div>

             {/* Split View Body */}
             <div className="flex-1 flex overflow-hidden">
                {/* Run A Panel */}
                <div className="flex-1 border-r border-gray-200 flex flex-col min-w-0 bg-white">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 font-bold text-gray-500 text-xs uppercase tracking-wider text-center sticky top-0">
                        실행 A ({runA.trigger_mode})
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                         <div className="absolute inset-0 overflow-y-auto">
                            <LogDetail run={runA} compactMode={true} />
                         </div>
                    </div>
                </div>

                {/* Run B Panel */}
                <div className="flex-1 flex flex-col min-w-0 bg-white">
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 font-bold text-blue-600 text-xs uppercase tracking-wider text-center sticky top-0">
                        실행 B ({runB.trigger_mode})
                    </div>
                     <div className="flex-1 overflow-hidden relative">
                         <div className="absolute inset-0 overflow-y-auto">
                            <LogDetail run={runB} compactMode={true} />
                         </div>
                    </div>
                </div>
             </div>
        </div>
    );
};
