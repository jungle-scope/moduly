import React from 'react';
import { TriggerType } from '../../../../types/Nodes';
interface TriggerSectionProps {
  type?: TriggerType;
}

const DEFAULT_TRIGGER = 'manual';

export const TriggerSection = ({ type }: TriggerSectionProps) => {
  const displayValue = type || DEFAULT_TRIGGER;

  return (
    <div className="flex flex-col gap-1">
      {/* 라벨: '트리거 방식'이라는 작은 제목 */}
      <label className="text-xs font-medium text-muted-foreground">
        트리거 방식
      </label>

      {/* 값: 실제 트리거 타입 (예: manual)을 회색 박스 안에 보여줍니다 */}
      <div className="rounded bg-muted px-2 py-1.5 text-xs text-foreground">
        {displayValue}
      </div>
    </div>
  );
};
