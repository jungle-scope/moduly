import { Workflow, ScrollText, Activity } from 'lucide-react';

export type ViewMode = 'edit' | 'log' | 'monitoring';

interface EditorViewSwitcherProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export default function EditorViewSwitcher({
  viewMode,
  onViewModeChange,
}: EditorViewSwitcherProps) {
  return (
    <div className="relative h-0 flex justify-center z-50">
      <div className="absolute top-3 -translate-y-1/2 bg-gray-100 p-1 rounded-lg flex items-center border border-gray-200/60">
        <button
          onClick={() => onViewModeChange('edit')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            viewMode === 'edit'
              ? 'bg-white text-gray-900 border border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 border border-transparent'
          }`}
        >
          <Workflow className="w-4 h-4" />
          <span>편집</span>
        </button>
        <button
          onClick={() => onViewModeChange('log')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            viewMode === 'log'
              ? 'bg-white text-gray-900 border border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 border border-transparent'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          <span>로그</span>
        </button>
        <button
          onClick={() => onViewModeChange('monitoring')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            viewMode === 'monitoring'
              ? 'bg-white text-gray-900 border border-gray-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 border border-transparent'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>모니터링</span>
        </button>
      </div>
    </div>
  );
}
