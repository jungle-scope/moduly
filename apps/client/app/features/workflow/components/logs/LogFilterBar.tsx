import { useState } from 'react';
import { Calendar, ChevronDown, Filter, RefreshCcw, ArrowUpDown } from 'lucide-react';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

interface LogFilterBarProps {
  onFilterChange: (filters: LogFilters) => void;
  availableVersions?: string[];
  availableServices?: { id: string; name: string }[]; // [NEW] 서비스 목록
}

export interface LogFilters {
  status: 'all' | 'success' | 'failed';
  version: 'all' | string;
  serviceId: 'all' | string; // [NEW]
  sortBy: 'latest' | 'oldest' | 'tokens_high' | 'tokens_low' | 'cost_high' | 'cost_low' | 'duration_long' | 'duration_short';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

export const LogFilterBar = ({ onFilterChange, availableVersions = [], availableServices = [] }: LogFilterBarProps) => {
  const [filters, setFilters] = useState<LogFilters>({
    status: 'all',
    version: 'all',
    serviceId: 'all',
    sortBy: 'latest',
    dateRange: { start: null, end: null },
  });

  const handleFilterChange = (key: keyof LogFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDatePreset = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(new Date(), days));
    handleFilterChange('dateRange', { start, end });
  };

  // 날짜 입력 처리 (string -> Date)
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    const newRange = { ...filters.dateRange, [type]: date };
    handleFilterChange('dateRange', newRange);
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 space-y-4">
      {/* 상단: 필터 및 빠른 액션 */}
      <div className="flex flex-wrap items-center gap-4">
        
        {/* 서비스 필터 (글로벌 전용) */}
        {availableServices.length > 0 && (
            <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                    value={filters.serviceId}
                    onChange={(e) => handleFilterChange('serviceId', e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
                >
                    <option value="all">모든 서비스</option>
                    {availableServices.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
        )}

        {/* 상태 필터 - 토글 버튼 */}
        <div className="flex items-center gap-2">
            {!availableServices.length && <Filter className="w-4 h-4 text-gray-500" />}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => handleFilterChange('status', filters.status === 'all' ? 'all' : 'all')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  filters.status === 'all'
                    ? 'bg-gray-800 text-white'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                전체
              </button>
              <button
                onClick={() => handleFilterChange('status', filters.status === 'success' ? 'all' : 'success')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center gap-1.5 ${
                  filters.status === 'success'
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-green-50 hover:text-green-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${filters.status === 'success' ? 'bg-white' : 'bg-green-500'}`} />
                성공
              </button>
              <button
                onClick={() => handleFilterChange('status', filters.status === 'failed' ? 'all' : 'failed')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-gray-200 flex items-center gap-1.5 ${
                  filters.status === 'failed'
                    ? 'bg-red-500 text-white'
                    : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${filters.status === 'failed' ? 'bg-white' : 'bg-red-500'}`} />
                실패
              </button>
            </div>
        </div>

        {/* 정렬 드롭다운 */}
        <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-gray-500" />
            <select 
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="latest">시간 (최신순)</option>
                <option value="oldest">시간 (오래된순)</option>
                <option value="tokens_high">토큰 (높은순)</option>
                <option value="tokens_low">토큰 (낮은순)</option>
                <option value="cost_high">비용 (높은순)</option>
                <option value="cost_low">비용 (낮은순)</option>
                <option value="duration_long">소요시간 (긴순)</option>
                <option value="duration_short">소요시간 (짧은순)</option>
            </select>
        </div>

        {/* 버전 필터 */}
        {availableVersions.length > 0 && (
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Version:</span>
                <select 
                    value={filters.version}
                    onChange={(e) => handleFilterChange('version', e.target.value)}
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

        {/* 빠른 날짜 프리셋 */}
        <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-gray-500 uppercase mr-1">기간:</span>
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

      {/* 하단: 날짜 범위 입력 */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">날짜 범위:</span>
            
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
        
        {/* 초기화 버튼 */}
        <button 
            onClick={() => {
                const reset = { status: 'all', version: 'all', serviceId: 'all', sortBy: 'latest', dateRange: { start: null, end: null } } as any;
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
