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

  // [NEW] 아이콘 및 색상 설정
  icon?: React.ReactNode;
  iconColor?: string; // 아이콘 배경색 (예: #3b82f6)
}

/**
 * [BaseNode]
 * 모든 노드의 공통 껍데기(UI)입니다.
 * - 아이콘 + 제목/설명 표시 (통일된 디자인)
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
  icon,
  iconColor = '#3b82f6', // 기본값: 파란색
}) => {
  return (
    <div
      className={cn(
        'min-w-[280px] rounded-[20px] border bg-white p-5 shadow-sm transition-all', // 더 둥글고 여유로운 패딩
        // 선택되었을 때: 파란색 테두리 (기존보다 얇고 깔끔하게)
        selected ? 'border-blue-500 shadow-md' : 'border-gray-100', // 기본 테두리 더 연하게
        // 실행 상태(status)에 따른 테두리 색상 및 애니메이션
        data.status === 'running' &&
          'border-blue-500 ring-2 ring-blue-500/20 animate-pulse',
        data.status === 'success' &&
          'border-green-500 ring-2 ring-green-500/20',
        data.status === 'failure' && 'border-red-500 ring-2 ring-red-500/20',
        className,
      )}
    >
      {/* 1. 입력 핸들 (Target) */}
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-blue-500 !border-[3px] !border-white shadow-sm -ml-1.5"
        />
      )}

      {/* 2. 노드 헤더 (아이콘 + 제목 + 설명) */}
      <div className="mb-4 flex items-center gap-4">
        {/* 아이콘 박스 */}
        {icon && (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ backgroundColor: iconColor }}
          >
            {/* 아이콘 크기 강제 조절 */}
            {React.isValidElement(icon) &&
              React.cloneElement(icon as React.ReactElement<any>, {
                className: 'w-7 h-7',
              })}
          </div>
        )}

        <div className="flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 leading-none mb-1">
            {data.title || 'Untitled Node'}
          </h3>
          {data.description && (
            <p className="text-xs font-medium text-gray-400 leading-relaxed line-clamp-2">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* 3. 노드 본문 (Children) */}
      <div className="text-sm">{children}</div>

      {/* 4. 출력 핸들 (Source) */}
      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-blue-500 !border-[3px] !border-white shadow-sm -mr-1.5"
        />
      )}
    </div>
  );
};
