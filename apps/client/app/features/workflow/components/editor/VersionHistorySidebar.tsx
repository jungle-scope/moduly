import React, { useEffect, useState } from 'react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { workflowApi } from '../../api/workflowApi';
import { DeploymentResponse } from '../../types/Deployment';
import { X, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export function VersionHistorySidebar() {
  const {
    isVersionHistoryOpen,
    toggleVersionHistory,
    activeWorkflowId,
    previewVersion,
    previewingVersion,
  } = useWorkflowStore();

  const [deployments, setDeployments] = useState<DeploymentResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch Version History
  useEffect(() => {
    if (isVersionHistoryOpen && activeWorkflowId) {
      const fetchHistory = async () => {
        try {
          setLoading(true);
          const data = await workflowApi.getDeployments(activeWorkflowId);
          // Sort by version descending (newest first)
          const sorted = data.sort((a, b) => b.version - a.version);
          setDeployments(sorted);
        } catch (error) {
          console.error('Failed to fetch version history:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isVersionHistoryOpen, activeWorkflowId]);

  if (!isVersionHistoryOpen) return null;

  return (
    <div className="absolute top-14 right-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2 text-gray-800">
          <Clock className="w-5 h-5" />
          <h2 className="font-semibold">버전 기록</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* <button className="p-1 hover:bg-gray-100 rounded">
            <Filter className="w-4 h-4 text-gray-500" />
          </button> */}
          <button
            onClick={toggleVersionHistory}
            className="p-1 hover:bg-gray-100 rounded text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Current Draft Indicator */}
      <div className="p-4 bg-blue-50/50 border-b border-blue-100">
        <div
          className={`relative flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
            !previewingVersion
              ? 'border-blue-500 bg-white shadow-sm'
              : 'border-transparent hover:bg-blue-100/50'
          }`}
          onClick={() => useWorkflowStore.getState().exitPreview()}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-3 h-3 rounded-full border-2 ${
                !previewingVersion
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-blue-300'
              }`}
            />
            {!previewingVersion && (
              <div className="w-0.5 h-full bg-blue-200 -mb-6" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm text-blue-900">현재 초안</div>
            <div className="text-xs text-blue-600 mt-0.5">
              편집 중인 상태입니다
            </div>
          </div>
          {!previewingVersion && (
            <div className="ml-auto text-blue-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            기록된 버전이 없습니다.
            <br />첫 배포를 진행해보세요!
          </div>
        ) : (
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-100 -z-10" />

            {deployments.map((v) => {
              const isSelected = previewingVersion?.id === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => previewVersion(v)}
                  className={`group relative flex gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-sm'
                      : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  {/* Timeline Dot */}
                  <div
                    className={`mt-1.5 w-3 h-3 rounded-full border-2 bg-white flex-shrink-0 z-10 ${
                      isSelected
                        ? 'border-blue-500'
                        : 'border-gray-300 group-hover:border-gray-400'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-medium text-sm truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}
                      >
                        {v.description || '제목 없는 버전'}
                      </span>
                      {/* {isSelected && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">선택됨</span>} */}
                      {/* Latest tag logic could go here if sort order allows */}
                    </div>

                    <div className="text-xs text-gray-500 flex flex-col gap-0.5">
                      <span>v{v.version}</span>
                      <span>
                        {format(new Date(v.created_at), 'yyyy-MM-dd HH:mm', {
                          locale: ko,
                        })}
                      </span>
                      <span className="text-gray-400">
                        by {v.created_by || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
