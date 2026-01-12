import { ScheduleTriggerNodeData } from '../../../../types/Nodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

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

const DAYS_OF_WEEK = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

/**
 * ScheduleTriggerNodePanel
 * Schedule Trigger 노드의 세부 설정 패널 (개선된 UI)
 */
export function ScheduleTriggerNodePanel({
  nodeId,
  data,
}: ScheduleTriggerNodePanelProps) {
  const updateNodeData = useWorkflowStore((state) => state.updateNodeData);

  // 로컬 상태 초기화 (data.ui_config 기반)
  const [mode, setMode] = useState<'basic' | 'advanced'>(
    data.ui_config?.mode || 'basic',
  );
  const [type, setType] = useState<'interval' | 'daily' | 'weekly' | 'monthly'>(
    data.ui_config?.type || 'interval',
  );

  const [intervalValue, setIntervalValue] = useState(
    data.ui_config?.intervalValue || 15,
  );
  const [intervalUnit, setIntervalUnit] = useState<'minutes' | 'hours'>(
    data.ui_config?.intervalUnit || 'minutes',
  );
  const [time, setTime] = useState(data.ui_config?.time || '09:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    data.ui_config?.daysOfWeek || [1, 3, 5],
  );
  const [dayOfMonth, setDayOfMonth] = useState(data.ui_config?.dayOfMonth || 1);

  // Cron 생성 로직
  const generateCron = () => {
    if (mode === 'advanced') return data.cron_expression;

    let cron = '';
    const [hour, minute] = time.split(':').map(Number); // HH:MM 파싱

    switch (type) {
      case 'interval':
        if (intervalUnit === 'minutes') {
          cron = `*/${intervalValue} * * * *`;
        } else {
          cron = `0 */${intervalValue} * * *`;
        }
        break;
      case 'daily':
        cron = `${minute} ${hour} * * *`;
        break;
      case 'weekly': {
        const days = daysOfWeek.join(',');
        cron = `${minute} ${hour} * * ${days}`;
        break;
      }
      case 'monthly':
        cron = `${minute} ${hour} ${dayOfMonth} * *`;
        break;
    }
    return cron;
  };

  // UI 상태 변경 시 Node Data 업데이트
  useEffect(() => {
    // Basic 모드일 때만 자동 생성하여 업데이트
    if (mode === 'basic') {
      const newCron = generateCron();
      // 변경 사항이 있을 때만 업데이트
      if (newCron !== data.cron_expression) {
        updateNodeData(nodeId, {
          cron_expression: newCron,
          ui_config: {
            mode,
            type,
            intervalValue,
            intervalUnit,
            time,
            daysOfWeek,
            dayOfMonth,
          },
        });
      }
    }
  }, [
    mode,
    type,
    intervalValue,
    intervalUnit,
    time,
    daysOfWeek,
    dayOfMonth,
    updateNodeData,
    nodeId,
    // data.cron_expression 의존성 제외 (무한 루프 방지)
  ]);

  // 모드 변경 핸들러
  const handleModeChange = (newMode: 'basic' | 'advanced') => {
    setMode(newMode);
    if (newMode === 'advanced') {
      // Advanced로 전환 시 ui_config만 모드 업데이트
      updateNodeData(nodeId, {
        ui_config: { ...data.ui_config, mode: 'advanced' } as any,
      });
    }
  };

  const toggleDayOfWeek = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection title="스케줄 설정" defaultOpen={true}>
        <div className="space-y-4">
          {/* 모드 선택 탭 (간단 구현) */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => handleModeChange('basic')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'basic'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              간편 설정
            </button>
            <button
              onClick={() => handleModeChange('advanced')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'advanced'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              고급 (Cron)
            </button>
          </div>

          {mode === 'basic' ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-200">
              {/* 빈도 타입 선택 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  빈도 (Frequency)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'interval', label: '반복' },
                    { id: 'daily', label: '매일' },
                    { id: 'weekly', label: '매주' },
                    { id: 'monthly', label: '매월' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setType(item.id as any)}
                      className={`py-2 text-xs border rounded transition-colors ${
                        type === item.id
                          ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1. 반복 (Interval) */}
              {type === 'interval' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      간격 값
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={intervalValue}
                      onChange={(e) =>
                        setIntervalValue(parseInt(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 text-xs border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      단위
                    </label>
                    <select
                      value={intervalUnit}
                      onChange={(e) =>
                        setIntervalUnit(e.target.value as 'minutes' | 'hours')
                      }
                      className="w-full px-3 py-2 text-xs border rounded bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="minutes">분</option>
                      <option value="hours">시간</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 2. 매일 (Daily) */}
              {type === 'daily' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    실행 시간
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              )}

              {/* 3. 매주 (Weekly) */}
              {type === 'weekly' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      요일 선택 (다중 선택 가능)
                    </label>
                    <div className="flex justify-between gap-1">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => toggleDayOfWeek(day.value)}
                          className={`w-8 h-8 flex items-center justify-center text-xs rounded-full border transition-all ${
                            daysOfWeek.includes(day.value)
                              ? 'bg-purple-600 border-purple-600 text-white font-bold shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-purple-300'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      실행 시간
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* 4. 매월 (Monthly) */}
              {type === 'monthly' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      날짜 (일)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) =>
                        setDayOfMonth(parseInt(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 text-xs border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      실행 시간
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>
              )}

              {/* 생성된 Cron 미리보기 */}
              <div className="p-2 bg-gray-50 rounded border border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500">생성된 Cron:</span>
                <code className="text-xs font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">
                  {generateCron()}
                </code>
              </div>
            </div>
          ) : (
            // Advanced Mode (기존 Cron 입력)
            <div className="space-y-3 animate-in fade-in zoom-in duration-200">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Cron 표현식
                  </label>
                  <a
                    href="https://crontab.guru/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5"
                  >
                    도움말 <HelpCircle className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="text"
                  value={data.cron_expression}
                  onChange={(e) =>
                    updateNodeData(nodeId, { cron_expression: e.target.value })
                  }
                  placeholder="0 9 * * *"
                  className="w-full px-3 py-2 text-sm border rounded hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1.5">
                  직접 Cron 표현식을 입력하여 정교한 스케줄을 설정할 수
                  있습니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <div className="my-2 h-px bg-gray-200" />

      <CollapsibleSection title="타임존" defaultOpen={true}>
        {/* 타임존 선택 (공통) */}
        <div>
          <select
            value={data.timezone}
            onChange={(e) =>
              updateNodeData(nodeId, { timezone: e.target.value })
            }
            className="w-full px-3 py-2 text-xs border rounded bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </CollapsibleSection>
    </div>
  );
}
