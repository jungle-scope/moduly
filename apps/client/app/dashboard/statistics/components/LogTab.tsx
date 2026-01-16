import { useState } from 'react';
import { useGlobalLogs, GlobalWorkflowRun } from '../hooks/useGlobalLogs';
import {
  LogFilterBar,
  LogFilters,
} from '@/app/features/workflow/components/logs/LogFilterBar';
import { LogList } from '@/app/features/workflow/components/logs/LogList';
import { LogDetail } from '@/app/features/workflow/components/logs/LogDetail';
import { ArrowLeft } from 'lucide-react';

export const LogTab = () => {
  const { logs, filterApps, loading, applyFilters } = useGlobalLogs();
  const [selectedLog, setSelectedLog] = useState<GlobalWorkflowRun | null>(
    null,
  );
  const selectedLogId = selectedLog?.id;

  const handleFilterChange = (filters: LogFilters) => {
    applyFilters(filters);
    setSelectedLog(null); // Reset selection on filter change
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-gray-500">전체 로그를 불러오는 중입니다...</div>
      </div>
    );
  }

  // 1. Detail View
  if (selectedLog) {
    return (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setSelectedLog(null)}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-bold text-gray-800">
            로그 상세 ({selectedLog.workflow_name})
          </h3>
        </div>

        <div className="flex-1 overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="h-full overflow-y-auto p-6 scroll-smooth">
            <LogDetail run={selectedLog} onCompareClick={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  // 2. List View
  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Filter Bar */}
      <LogFilterBar
        onFilterChange={handleFilterChange}
        availableServices={filterApps}
        availableVersions={[]} // Global view usually doesn't show versions unless selected
      />

      {/* Log List */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-0 scroll-smooth">
          {logs.length > 0 ? (
            <LogList
              logs={logs}
              onSelect={(log) => setSelectedLog(log as GlobalWorkflowRun)}
              selectedLogId={selectedLogId}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-gray-400">
              표시할 로그가 없습니다.
            </div>
          )}
        </div>

        {/* Footer / Pagination Placeholder */}
        <div className="p-4 border-t border-gray-100 text-center text-xs text-gray-400">
          최근 20건의 로그를 각 서비스별로 수집하여 표시합니다.
        </div>
      </div>
    </div>
  );
};
