import React from 'react';
import { IconChevronUp, IconChevronDown } from '../icons';

interface OrderControlsProps {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (index: number, direction: 'up' | 'down') => void;
}

/**
 * 변수 순서 변경(위/아래) 버튼 그룹
 */
export const OrderControls = ({
  index,
  isFirst,
  isLast,
  onMove,
}: OrderControlsProps) => {
  return (
    <div className="flex flex-col gap-0.5 pt-1">
      <button
        onClick={() => onMove(index, 'up')}
        disabled={isFirst}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <IconChevronUp className="h-3 w-3" />
      </button>
      <button
        onClick={() => onMove(index, 'down')}
        disabled={isLast}
        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
      >
        <IconChevronDown className="h-3 w-3" />
      </button>
    </div>
  );
};
