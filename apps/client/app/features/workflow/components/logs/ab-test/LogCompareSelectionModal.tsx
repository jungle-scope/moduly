import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { X, CheckCircle2, XCircle, PlayCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LogExecutionPath } from '../detail-components/LogExecutionPath';

interface LogCompareSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (run: WorkflowRun) => void;
  currentRunId: string;
  logs: WorkflowRun[];
}

export const LogCompareSelectionModal = ({ 
    isOpen, 
    onClose, 
    onSelect, 
    currentRunId, 
    logs 
}: LogCompareSelectionModalProps) => {
  if (!isOpen) return null;

  // 자신을 제외한 로그만 필터링
  const availableLogs = logs.filter(log => log.id !== currentRunId);

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">비교할 실행 로그 선택</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-100">
            <p className="text-sm text-gray-600">
                현재 보고 있는 실행(ID: <span className="font-mono font-bold">{currentRunId.slice(0, 8)}</span>)과 비교할 대상을 목록에서 선택해주세요.
            </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {availableLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    비교할 다른 실행 기록이 없습니다.
                </div>
            ) : (
                availableLogs.map(log => (
                    <button
                        key={log.id}
                        onClick={() => onSelect(log)}
                        className="w-full flex flex-col p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all text-left group"
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center
                                ${log.status === 'success' ? 'bg-green-100 text-green-600' : 
                                  log.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}
                            `}>
                                {log.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                                 log.status === 'failed' ? <XCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                            </div>
                            <div>
                                <div className="font-medium text-gray-800 text-sm flex items-center gap-2">
                                    <span>{format(new Date(log.started_at), 'yyyy-MM-dd HH:mm:ss', { locale: ko })}</span>
                                    {log.trigger_mode === 'manual' && (
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded uppercase font-bold tracking-wider">TEST</span>
                                    )}
                                    {/* [NEW] Version Badge */}
                                    {log.workflow_version && (
                                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                                            v{log.workflow_version}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 font-mono flex items-center gap-3">
                                    <span>ID: {log.id.slice(0, 8)}</span>
                                    <span>•</span>
                                    <span>{log.duration ? `${log.duration.toFixed(2)}s` : '-'}</span>
                                    
                                    {/* [NEW] Token & Cost Stats */}
                                    {(log.total_tokens || 0) > 0 && (
                                        <>
                                            <span className="text-gray-300">|</span>
                                            <span className="flex items-center gap-1">
                                                🪙 {log.total_tokens?.toLocaleString()}
                                            </span>
                                            {(log.total_cost || 0) > 0 && (
                                                <span className="flex items-center gap-1 text-gray-600">
                                                    (💰 ${Number(log.total_cost).toFixed(6)})
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    선택
                                </div>
                            </div>
                        </div>

                    {/* Execution Preview (Smaller) */}
                    <div className="mt-3 pt-3 border-t border-gray-50 w-full overflow-hidden" 
                         style={{ minHeight: '60px' }}> {/* Force height for visibility */}
                        <div className="transform scale-75 origin-top-left w-[130%]" onClick={(e) => e.stopPropagation()}>
                                <LogExecutionPath 
                                nodeRuns={log.node_runs || []} 
                                onNodeSelect={() => {}} 
                                selectedNodeId={null} 
                                readOnly={true}
                                />
                        </div>
                    </div>
                    </button>
                ))
            )}
        </div>

      </div>
    </div>
  );
};
