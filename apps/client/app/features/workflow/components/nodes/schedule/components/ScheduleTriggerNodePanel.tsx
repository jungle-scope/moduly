import { ScheduleTriggerNodeData } from '../../../../types/Nodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';

interface ScheduleTriggerNodePanelProps {
  nodeId: string;
  data: ScheduleTriggerNodeData;
}

// 타임존 목록
const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
];

// Cron 프리셋
const CRON_PRESETS = [
  { label: '매일 오전 9시', value: '0 9 * * *' },
  { label: '매일 오후 6시', value: '0 18 * * *' },
  { label: '매주 월요일 오전 10시', value: '0 10 * * 1' },
  { label: '매달 1일 오전 9시', value: '0 9 1 * *' },
  { label: '매시간', value: '0 * * * *' },
  { label: '30분마다', value: '*/30 * * * *' },
];

/**
 * ScheduleTriggerNodePanel
 * Schedule Trigger 노드의 세부 설정 패널
 */
export function ScheduleTriggerNodePanel({
  nodeId,
  data,
}: ScheduleTriggerNodePanelProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  const handleCronChange = (cron_expression: string) => {
    updateNodeData(nodeId, { cron_expression });
  };

  const handleTimezoneChange = (timezone: string) => {
    updateNodeData(nodeId, { timezone });
  };

  const handlePresetSelect = (preset: string) => {
    handleCronChange(preset);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Cron Expression Section */}
      <CollapsibleSection title="스케줄 설정">
        <div className="space-y-3">
          {/* Cron 프리셋 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              프리셋
            </label>
            <select
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            >
              <option value="">프리셋 선택...</option>
              {CRON_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label} ({preset.value})
                </option>
              ))}
            </select>
          </div>

          {/* Cron 표현식 입력 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cron 표현식
            </label>
            <input
              type="text"
              value={data.cron_expression}
              onChange={(e) => handleCronChange(e.target.value)}
              placeholder="0 9 * * *"
              className="w-full px-3 py-2 text-sm border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              형식: 분 시 일 월 요일 (예: 0 9 * * * = 매일 오전 9시)
            </p>
          </div>

          {/* 타임존 선택 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              타임존
            </label>
            <select
              value={data.timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* 도움말 */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
        <p className="font-medium mb-1">💡 Cron 표현식 가이드</p>
        <ul className="space-y-0.5 ml-4 list-disc">
          <li>* * * * * = 분 시 일 월 요일</li>
          <li>0 9 * * * = 매일 오전 9시</li>
          <li>*/30 * * * * = 30분마다</li>
          <li>0 10 * * 1 = 매주 월요일 오전 10시</li>
        </ul>
      </div>
    </div>
  );
}
