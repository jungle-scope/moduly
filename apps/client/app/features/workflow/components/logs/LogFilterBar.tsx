import { useState } from 'react';
import { Calendar, ChevronDown, Filter, RefreshCcw } from 'lucide-react';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

interface LogFilterBarProps {
  onFilterChange: (filters: LogFilters) => void;
  availableVersions?: string[]; // [NEW] 동적 버전 목록
}

export interface LogFilters {
  status: 'all' | 'success' | 'failed';
  version: 'all' | string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

export const LogFilterBar = ({ onFilterChange, availableVersions = [] }: LogFilterBarProps) => {
  const [filters, setFilters] = useState<LogFilters>({
    status: 'all',
    version: 'all',
    dateRange: { start: null, end: null },
  });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilters = { ...filters, status: e.target.value as any };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFilters = { ...filters, version: e.target.value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDatePreset = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(new Date(), days));
    const newFilters = { ...filters, dateRange: { start, end } };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  // Date input handling (string to Date)
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    const newRange = { ...filters.dateRange, [type]: date };
    
    // Auto-adjust logic: if start > end, swap or warn? For simplicity, just set.
    const newFilters = { ...filters, dateRange: newRange };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 space-y-4">
      {/* Upper Row: Status & Version & Quick Actions */}
      <div className="flex flex-wrap items-center gap-4">
        
        {/* Status Filter */}
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select 
                value={filters.status}
                onChange={handleStatusChange}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
                <option value="all">모든 상태</option>
                <option value="success">성공 (Success)</option>
                <option value="failed">실패 (Failed)</option>
            </select>
        </div>

        {/* Version Filter (Show only if versions exist) */}
        {availableVersions && availableVersions.length > 0 && (
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Version:</span>
                <select 
                    value={filters.version}
                    onChange={handleVersionChange}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                >
                    <option value="all">전체 버전</option>
                    {availableVersions.map(v => (
                        <option key={v} value={v}>{v}</option>
                    ))}
                </select>
            </div>
        )}

        <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>

        {/* Quick Date Presets */}
        <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Period:</span>
            {[
                { label: '1일', days: 1 },
                { label: '3일', days: 3 },
                { label: '7일', days: 7 },
                { label: '1개월', days: 30 },
            ].map((preset) => (
                <button
                    key={preset.days}
                    onClick={() => handleDatePreset(preset.days)}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 transition-colors whitespace-nowrap"
                >
                    {preset.label}
                </button>
            ))}
        </div>
      </div>

      {/* Lower Row: Date Range Inputs */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">Date Range:</span>
            
            <input 
                type="date"
                value={filters.dateRange.start ? format(filters.dateRange.start, 'yyyy-MM-dd') : ''}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-sm bg-white"
            />
            <span className="text-gray-400">~</span>
            <input 
                type="date"
                value={filters.dateRange.end ? format(filters.dateRange.end, 'yyyy-MM-dd') : ''}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="px-2 py-1 border border-gray-200 rounded text-sm bg-white"
            />
        </div>
        
        {/* Reset Button (Optional) */}
        <button 
            onClick={() => {
                const reset = { status: 'all', version: 'all', dateRange: { start: null, end: null } } as any;
                setFilters(reset);
                onFilterChange(reset);
            }}
            className="text-xs text-gray-400 underline hover:text-gray-600 flex items-center gap-1"
        >
            <RefreshCcw className="w-3 h-3" /> 초기화
        </button>
      </div>
    </div>
  );
};
