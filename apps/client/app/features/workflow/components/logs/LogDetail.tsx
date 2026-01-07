import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { WorkflowRun, WorkflowNodeRun } from '@/app/features/workflow/types/Api';
import { 
  CheckCircle2, XCircle, Clock, ArrowRight, BrainCircuit, PlayCircle, AlertCircle,
  Play, MessageSquare, GitFork, Code, Globe, Webhook, Calendar, Database,
  Slack, Mail, Sparkles, FileText, Bot
} from 'lucide-react';
import { useState } from 'react';
import { LogExecutionPath } from './LogExecutionPath';
import { LogTokenAnalysis } from './LogTokenAnalysis';

interface LogDetailProps {
  run: WorkflowRun;
  onCompareClick?: () => void;
  compactMode?: boolean;
}

// Node type to Korean label and icon mapping
const getNodeDisplayInfo = (nodeType: string): { label: string; icon: React.ReactNode; color: string } => {
  const mapping: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    startNode: { label: '시작', icon: <Play className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
    answerNode: { label: '응답', icon: <MessageSquare className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
    llmNode: { label: 'LLM', icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
    conditionNode: { label: '조건', icon: <GitFork className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
    codeNode: { label: '코드', icon: <Code className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50' },
    httpRequestNode: { label: 'HTTP 요청', icon: <Globe className="w-4 h-4" />, color: 'text-cyan-600 bg-cyan-50' },
    webhookTriggerNode: { label: '웹훅 트리거', icon: <Webhook className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
    scheduleTriggerNode: { label: '스케줄 트리거', icon: <Calendar className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
    knowledgeNode: { label: '지식 검색', icon: <Database className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
    slackPostNode: { label: 'Slack 전송', icon: <Slack className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
    emailNode: { label: '이메일', icon: <Mail className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
    workflowNode: { label: '워크플로우 호출', icon: <Bot className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
    templateNode: { label: '템플릿', icon: <FileText className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50' },
  };
  
  return mapping[nodeType] || { label: nodeType, icon: <BrainCircuit className="w-4 h-4" />, color: 'text-gray-600 bg-gray-50' };
};

// Calculate node duration from started_at and finished_at
const getNodeDuration = (node: WorkflowNodeRun): string | null => {
  if (!node.started_at || !node.finished_at) return null;
  const start = new Date(node.started_at).getTime();
  const end = new Date(node.finished_at).getTime();
  const durationMs = end - start;
  if (durationMs < 0) return null;
  return (durationMs / 1000).toFixed(2);
};

export const LogDetail = ({ run, onCompareClick, compactMode = false }: LogDetailProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = run.node_runs?.find(n => n.node_id === selectedNodeId) || run.node_runs?.[0];

  // Calculate actual total tokens and cost from node runs
  const { totalTokens, totalCost } = (run.node_runs || []).reduce(
    (acc, node) => {
      const usage = (node.outputs as any)?.usage;
      if (usage) {
        acc.totalTokens += (usage.total_tokens || 0);
        if (typeof (node.outputs as any)?.cost === 'number') {
             acc.totalCost += (node.outputs as any).cost;
        }
      }
      return acc;
    },
    { totalTokens: 0, totalCost: 0 }
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto p-1">
      {/* 1. 헤더: 실행 요약 및 컨트롤 */}
      <div className="border-b border-gray-100 pb-6 mb-6">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">실행 상세</h2>
                {run.status === 'success' ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> SUCCESS
                    </span>
                ) : run.status === 'failed' ? (
                    <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> FAILED
                    </span>
                ) : (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" /> RUNNING
                    </span>
                )}
            </div>
            
            {onCompareClick && (
                <button 
                    onClick={onCompareClick}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm shadow-sm transition-colors"
                >
                    <span>⚡ A/B Compare</span>
                </button>
            )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div>
                <span className="block text-gray-500 text-xs mb-1">시작 시간</span>
                <span className="font-medium flex items-center gap-1 text-gray-800">
                   <Clock className="w-3 h-3" /> 
                   {format(new Date(run.started_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}
                </span>
            </div>
            <div>
                <span className="block text-gray-500 text-xs mb-1">소요 시간</span>
                <span className="font-medium text-gray-800">
                    {run.duration ? `${run.duration.toFixed(2)}초` : '-'}
                </span>
            </div>
            <div>
                <span className="block text-gray-500 text-xs mb-1">총 토큰</span>
                <span className="font-medium text-gray-800">
                    {totalTokens.toLocaleString()}
                </span>
            </div>
            <div>
                <span className="block text-gray-500 text-xs mb-1">총 비용</span>
                <span className="font-medium text-gray-800 flex items-center gap-1">
                    <span className="text-amber-600">
                        {totalCost > 0 ? `$${totalCost.toFixed(4)}` : '-'}
                    </span>
                </span>
            </div>
        </div>
      </div>

      {/* 2. Token Analysis Sections */}
      <LogTokenAnalysis run={run} />

      {/* 3. Visual Execution Path */}
      <div className="mb-6">
          <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-blue-500" />
            실행 흐름
          </h3>
          <LogExecutionPath 
              nodeRuns={run.node_runs || []} 
              onNodeSelect={setSelectedNodeId}
              selectedNodeId={selectedNode?.node_id ?? null}
          />
      </div>

      {/* 3. 상세 내용 (좌우 분할) */}
      <div className="flex gap-6 items-start">
        <div className="w-1/3 border-r border-gray-100 pr-6">
            <h3 className="font-bold text-gray-800 mb-4 sticky top-0 bg-white py-2 z-10">노드 실행 경로</h3>
            <div className="space-y-3">
                {run.node_runs?.map((node, idx) => {
                    const displayInfo = getNodeDisplayInfo(node.node_type);
                    const duration = getNodeDuration(node);
                    
                    return (
                    <button 
                        key={`${node.node_id}-${idx}`}
                        onClick={() => setSelectedNodeId(node.node_id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                            (selectedNode?.node_id === node.node_id)
                                ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100' 
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <div className={`flex ${compactMode ? 'flex-col items-start gap-1' : 'justify-between items-center'} mb-1`}>
                            <span className={`font-semibold text-sm flex items-center gap-2 px-2 py-1 rounded ${displayInfo.color}`}>
                                {displayInfo.icon}
                                {displayInfo.label}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                                node.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                                {node.status === 'success' ? '성공' : '실패'}
                            </span>
                        </div>
                        {duration && (
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                소요: {duration}초
                            </div>
                        )}
                    </button>
                    );
                })}
            </div>
        </div>

        <div className="flex-1 pl-2">
             <h3 className="font-bold text-gray-800 mb-4 sticky top-0 bg-white py-2 z-10">노드 상세 정보</h3>
             {selectedNode ? (
                 <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Input Data</h4>
                        <pre className="text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedNode.inputs, null, 2)}
                        </pre>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Output Data</h4>
                        <pre className="text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap break-all">
                            {JSON.stringify(selectedNode.outputs, null, 2)}
                        </pre>
                    </div>

                    {selectedNode.error_message && (
                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                            <h4 className="font-bold text-red-700 flex items-center gap-2 mb-1">
                                <AlertCircle className="w-4 h-4" /> 에러 발생
                            </h4>
                            <p className="text-sm text-red-600">{selectedNode.error_message}</p>
                        </div>
                    )}
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <BrainCircuit className="w-12 h-12 mb-3 opacity-20" />
                    <p>왼쪽에서 노드를 선택하여 상세 정보를 확인하세요.</p>
                </div>
             )}
        </div>

      </div>
    </div>
  );
};
