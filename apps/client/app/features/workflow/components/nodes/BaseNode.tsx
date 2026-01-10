import {
  Handle,
  Position,
  useNodeId,
  useHandleConnections,
  HandleProps,
} from '@xyflow/react';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { BaseNodeData } from '../../types/Nodes';

interface BaseNodeProps {
  id?: string;
  data: BaseNodeData;
  children?: React.ReactNode;

  showSourceHandle?: boolean;
  showTargetHandle?: boolean;

  className?: string;
  selected?: boolean;

  icon?: React.ReactNode;
  iconColor?: string;
}

export const SmartHandle: React.FC<HandleProps & { className?: string }> = ({
  className,
  ...props
}) => {
  return (
    <Handle
      {...props}
      className={cn(
        // 히트 영역은 투명하게 유지하되, 드래그하기 쉽도록 크기 확보
        '!w-6 !h-6 !bg-transparent !border-0 rounded-full z-50 flex items-center justify-center',
        className,
      )}
    >
      {/* 
         시각적 가이드: 
         노드에 마우스를 올렸을(group-hover) 때만 중앙에 작은 파란색 점이 나타납니다.
         이것이 '연결 가능한 지점'임을 암시(Hint)합니다. 
      */}
      <div className="w-3 h-3 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Handle>
  );
};

export const JigsawBackground = ({
  width,
  height,
  selected,
  status,
}: {
  width: number;
  height: number;
  selected?: boolean;
  status?: string;
}) => {
  const r = 16;

  const d = useMemo(() => {
    if (width === 0 || height === 0) return '';

    return `
      M ${r} 0
      L ${width - r} 0
      Q ${width} 0 ${width} ${r}
      L ${width} ${height - r}
      Q ${width} ${height} ${width - r} ${height}
      L ${r} ${height}
      Q 0 ${height} 0 ${height - r}
      L 0 ${r}
      Q 0 0 ${r} 0
    `;
  }, [width, height]);

  let strokeColor = '#d1d5db';
  const strokeWidth = 2;

  if (selected) {
    strokeColor = '#3b82f6'; // blue-500
  } else if (status === 'running') {
    strokeColor = '#3b82f6';
  } else if (status === 'success') {
    strokeColor = '#22c55e'; // green-500
  } else if (status === 'failure') {
    strokeColor = '#ef4444'; // red-500
  }

  return (
    <svg
      width={width}
      height={height}
      className={`absolute top-0 left-0 pointer-events-none drop-shadow-sm transition-all duration-300`}
      style={{ overflow: 'visible', zIndex: 0 }}
    >
      <path
        d={d}
        fill="white"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  children,
  showSourceHandle = true,
  showTargetHandle = true,
  className,
  selected,
  icon,
  iconColor = '#3b82f6',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.offsetWidth > 0 || ref.current.offsetHeight > 0) {
      setDimensions({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight,
      });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          setDimensions({
            width: entry.borderBoxSize[0].inlineSize,
            height: entry.borderBoxSize[0].blockSize,
          });
        } else {
          setDimensions({
            width: (entry.contentRect.width || 0) + 56,
            height: (entry.contentRect.height || 0) + 56,
          });
          if (ref.current) {
            setDimensions({
              width: ref.current.offsetWidth,
              height: ref.current.offsetHeight,
            });
          }
        }
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const getHandleStyle = (side: 'left' | 'right') => {
    if (side === 'left') {
      return { left: '-20px' };
    } else {
      return { right: '-20px' };
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'relative group min-w-[320px] p-7 transition-all',
        className,
      )}
      style={{ isolation: 'isolate', overflow: 'visible' }}
    >
      <JigsawBackground
        width={dimensions.width}
        height={dimensions.height}
        selected={selected}
        status={data.status}
      />

      <div className="relative z-10">
        {showTargetHandle && (
          <SmartHandle
            type="target"
            position={Position.Left}
            className="-ml-2"
            style={getHandleStyle('left')}
          />
        )}

        <div className="mb-4 flex items-center gap-4">
          {icon && (
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: iconColor }}
            >
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
          </div>
        </div>

        <div className="text-sm">{children}</div>

        {showSourceHandle && (
          <SmartHandle
            type="source"
            position={Position.Right}
            className="-mr-2"
            style={getHandleStyle('right')}
          />
        )}
      </div>
    </div>
  );
};
