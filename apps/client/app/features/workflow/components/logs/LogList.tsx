import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { CheckCircle2, XCircle, Clock, PlayCircle } from 'lucide-react';
import { LogExecutionPath } from './LogExecutionPath';

interface LogListProps {
  logs: WorkflowRun[];
  onSelect: (log: WorkflowRun) => void;
  selectedLogId?: string;
  className?: string;
  selectionMode?: 'A' | 'B' | null; // [NEW]
  abRunAId?: string | null;
  abRunBId?: string | null;
}

export const LogList = ({ logs, onSelect, selectedLogId, className = '', selectionMode, abRunAId, abRunBId }: LogListProps) => {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-400 h-full">
        <Clock className="w-12 h-12 mb-2 opacity-20" />
        <p>기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={` ${className}`}>
      {logs.map((log) => {
        const isA = abRunAId === log.id;
        const isB = abRunBId === log.id;
        
        return (
          <button
            key={log.id}
            onClick={() => onSelect(log)}
            className={`w-full text-left p-4 border-b border-gray-100 transition-all flex flex-col group relative
              ${selectedLogId === log.id ? 'bg-gray-50' : 'hover:bg-gray-50'}
              ${selectionMode ? 'hover:ring-2 hover:ring-inset hover:ring-blue-400 hover:bg-blue-50 cursor-pointer' : ''}
              ${isA ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-500 z-10' : ''}
              ${isB ? 'bg-indigo-50/80 ring-2 ring-inset ring-indigo-500 z-10' : ''}
            `}
          >
            {/* A/B Selection Indicators */}
            {isA && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end opacity-100">
                    <span className="text-4xl font-black text-blue-200/40 select-none absolute right-0 -top-6 pointer-events-none">A</span>
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm z-10">RUN A (기준)</span>
                </div>
            )}
            {isB && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-end opacity-100">
                    <span className="text-4xl font-black text-indigo-200/40 select-none absolute right-0 -top-6 pointer-events-none">B</span>
                    <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm z-10">RUN B (비교군)</span>
                </div>
            )}

            {selectionMode && (
                <div className="absolute right-4 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                        {selectionMode === 'A' ? 'A 기준 실행으로 선택' : 'B 비교군 실행으로 선택'}
                    </span>
                </div>
            )}
          <div className="flex items-start gap-3 w-full">
            {/* 상태 아이콘 */}
            <div className="mt-1 flex-shrink-0">
              {log.status === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : log.status === 'failed' ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <PlayCircle className="w-5 h-5 text-blue-500 animate-spin-slow" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                 {/* [NEW] Service Name (Global Log View only) */}
                 {(log as any).workflow_name && (
                    <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                        {(log as any).workflow_name}
                    </span>
                 )}

                 <span className="font-medium text-gray-900">
                    {log.trigger_mode === 'manual' ? '테스트 실행' : '배포 실행'}
                 </span>
                 <span className="text-xs text-gray-500">
                    {new Date(log.started_at).toLocaleString()}
                 </span>
                 {log.workflow_version && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
                        v{log.workflow_version}
                    </span>
                 )}
              </div>

              {/* 토큰, 비용, 소요시간 표시 */}
              <div className="mt-2 flex items-center gap-3 text-xs">
                  {log.duration !== undefined && log.duration > 0 && (
                      <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          소요: {log.duration.toFixed(1)}초
                      </span>
                  )}
                  {log.total_tokens !== undefined && log.total_tokens > 0 && (
                      <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          토큰: {log.total_tokens.toLocaleString()}
                      </span>
                  )}
                  {log.total_cost !== undefined && log.total_cost > 0 && (
                      <span className="text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                          비용: ${Number(log.total_cost).toFixed(8)}
                      </span>
                  )}
              </div>
            </div>
          </div>

        </button>
        );
      })}
    </div>
  );
};
