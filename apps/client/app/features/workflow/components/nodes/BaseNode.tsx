import { Handle, Position } from '@xyflow/react';
import React from 'react';

import { cn } from '@/lib/utils';
import { BaseNodeData } from '../../types/Nodes';

interface BaseNodeProps {
  data: BaseNodeData;
  children?: React.ReactNode;

  // 핸들 설정 (필요한 핸들만 켜고 끌 수 있게)
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;

  className?: string;
  selected?: boolean;
}

/**
 * [BaseNode]
 * 모든 노드의 공통 껍데기(UI)입니다.
 * - 제목/설명 표시
 * - 선택(selected) 상태 스타일링
 * - 입력/출력 핸들(점) 배치
 */
export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  children,
  showSourceHandle = true,
  showTargetHandle = true,
  className,
  selected,
}) => {
  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg border bg-card px-4 py-3 shadow-md transition-all',
        // 선택되었을 때 테두리 색상 강조
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        className,
      )}
    >
      {/* 1. 입력 핸들 (Target) - 위쪽 or 왼쪽 */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left} // 기본값은 왼쪽으로 설정 (취향에 따라 Top 변경)
          className="!bg-primary"
        />
      )}

      {/* 2. 노드 헤더 (제목 & 설명) */}
      <div className="mb-2 border-b pb-2">
        <h3 className="text-sm font-semibold text-foreground">
          {data.title || 'Untitled Node'}
        </h3>
        {data.description && (
          <p className="text-xs text-muted-foreground">{data.description}</p>
        )}
      </div>

      {/* 3. 노드 본문 (Children) */}
      <div className="text-sm">{children}</div>

      {/* 4. 출력 핸들 (Source) - 아래쪽 or 오른쪽 */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right} // 기본값은 오른쪽 (취향에 따라 Bottom 변경)
          className="!bg-primary"
        />
      )}
    </div>
  );
};
