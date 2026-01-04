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

// === Types ===
export type PuzzleType = 'start' | 'end' | 'middle';
type SideShape = 'flat' | 'tab' | 'blank';

interface BaseNodeProps {
  id?: string; // Node ID passed from parent
  data: BaseNodeData;
  puzzleType?: PuzzleType;
  children?: React.ReactNode;

  // 핸들 설정
  showSourceHandle?: boolean;
  showTargetHandle?: boolean;

  className?: string; // 추가적인 스타일
  selected?: boolean;

  // 아이콘 및 색상 설정
  icon?: React.ReactNode;
  iconColor?: string;
}

// === SmartHandle Component ===
const SmartHandle: React.FC<HandleProps & { className?: string }> = ({
  className,
  ...props
}) => {
  const nodeId = useNodeId();
  const connections = useHandleConnections({
    type: props.type,
    id: props.id,
    nodeId: nodeId || undefined,
  });

  const isConnected = connections.length > 0;

  return (
    <Handle
      {...props}
      className={cn(
        // 기본 스타일
        '!w-4 !h-4 !bg-white !border-2 !border-gray-300 !rounded-full transition-all duration-300 z-50 flex items-center justify-center',
        // 가시성 제어
        isConnected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        // 호버 효과
        'hover:!w-6 hover:!h-6 hover:!bg-blue-500 hover:!border-0 hover:scale-110',
        className,
      )}
    >
      <Plus
        className="w-3.5 h-3.5 text-white opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        strokeWidth={3}
      />
      <style jsx>{`
        .react-flow__handle:hover svg {
          opacity: 1 !important;
        }
      `}</style>
    </Handle>
  );
};

// === Helper: Random Shape Generator ===
const getVerticalShape = (id: string, seedOffset: number): SideShape => {
  if (!id) return 'flat';
  // ID 문자열의 합을 시드로 사용
  const sum = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const val = (sum + seedOffset) % 3;
  if (val === 0) return 'flat';
  if (val === 1) return 'tab';
  return 'blank';
};

// === Jigsaw Path Generator ===
const JigsawBackground = ({
  width,
  height,
  shapes,
  selected,
  status,
}: {
  width: number;
  height: number;
  shapes: {
    top: SideShape;
    right: SideShape;
    bottom: SideShape;
    left: SideShape;
  };
  selected?: boolean;
  status?: string;
}) => {
  // Path Constants
  const r = 16; // Corner radius (rounded-2xl ~ 16px)
  const tabSize = 34; // 탭 너비 (24 -> 34: 더 넓게)
  const tabHeight = 14; // 탭 높이 (8 -> 14: 더 튀어나오게)

  // Draw Path Function
  const d = useMemo(() => {
    if (width === 0 || height === 0) return '';
    let path = `M ${r} 0`;

    // 1. Top Side
    const topCenter = width / 2;
    if (shapes.top === 'flat') {
      path += ` L ${width - r} 0`;
    } else {
      const sign = shapes.top === 'tab' ? -1 : 1;
      path += ` L ${topCenter - tabSize / 2} 0`;
      // Smooth Curve
      path += ` C ${topCenter - tabSize / 6} 0, ${topCenter - tabSize / 2} ${sign * tabHeight}, ${topCenter} ${sign * tabHeight}`;
      path += ` C ${topCenter + tabSize / 2} ${sign * tabHeight}, ${topCenter + tabSize / 6} 0, ${topCenter + tabSize / 2} 0`;
      path += ` L ${width - r} 0`;
    }

    // Top-Right Corner
    path += ` Q ${width} 0 ${width} ${r}`;

    // 2. Right Side
    const rightCenter = height / 2;
    if (shapes.right === 'flat') {
      path += ` L ${width} ${height - r}`;
    } else {
      const sign = shapes.right === 'tab' ? 1 : -1;
      path += ` L ${width} ${rightCenter - tabSize / 2}`;
      path += ` C ${width} ${rightCenter - tabSize / 6}, ${width + sign * tabHeight} ${rightCenter - tabSize / 2}, ${width + sign * tabHeight} ${rightCenter}`;
      path += ` C ${width + sign * tabHeight} ${rightCenter + tabSize / 2}, ${width} ${rightCenter + tabSize / 6}, ${width} ${rightCenter + tabSize / 2}`;
      path += ` L ${width} ${height - r}`;
    }

    // Bottom-Right Corner
    path += ` Q ${width} ${height} ${width - r} ${height}`;

    // 3. Bottom Side
    if (shapes.bottom === 'flat') {
      path += ` L ${r} ${height}`;
    } else {
      const sign = shapes.bottom === 'tab' ? 1 : -1;
      path += ` L ${topCenter + tabSize / 2} ${height}`;
      path += ` C ${topCenter + tabSize / 6} ${height}, ${topCenter + tabSize / 2} ${height + sign * tabHeight}, ${topCenter} ${height + sign * tabHeight}`;
      path += ` C ${topCenter - tabSize / 2} ${height + sign * tabHeight}, ${topCenter - tabSize / 6} ${height}, ${topCenter - tabSize / 2} ${height}`;
      path += ` L ${r} ${height}`;
    }

    // Bottom-Left Corner
    path += ` Q 0 ${height} 0 ${height - r}`;

    // 4. Left Side
    if (shapes.left === 'flat') {
      path += ` L 0 ${r}`;
    } else {
      const sign = shapes.left === 'tab' ? -1 : 1;
      path += ` L 0 ${rightCenter + tabSize / 2}`;
      path += ` C 0 ${rightCenter + tabSize / 6}, ${sign * tabHeight} ${rightCenter + tabSize / 2}, ${sign * tabHeight} ${rightCenter}`;
      path += ` C ${sign * tabHeight} ${rightCenter - tabSize / 2}, 0 ${rightCenter - tabSize / 6}, 0 ${rightCenter - tabSize / 2}`;
      path += ` L 0 ${r}`;
    }

    // Top-Left Corner
    path += ` Q 0 0 ${r} 0`;

    return path;
  }, [width, height, shapes]);

  // Stroke/Fill
  let strokeColor = '#d1d5db'; // gray-300
  const strokeWidth = 2; // matches border-2

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

/**
 * [BaseNode]
 * 퍼즐 모양 디자인 적용
 */
export const BaseNode: React.FC<BaseNodeProps> = ({
  id = '',
  data,
  puzzleType = 'middle', // Default to middle
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

  // Resize Observer
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.borderBoxSize && entry.borderBoxSize.length > 0) {
          setDimensions({
            width: entry.borderBoxSize[0].inlineSize,
            height: entry.borderBoxSize[0].blockSize,
          });
        } else {
          // Fallback for older browsers
          setDimensions({
            width: (entry.contentRect.width || 0) + 40, // content + padding(20*2) approx (unsafe)
            height: (entry.contentRect.height || 0) + 40,
          });
          // Better fallback: just read offsetWidth
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

  // Determine Shapes
  const shapes = useMemo(() => {
    const top = getVerticalShape(id, 0);
    const bottom = getVerticalShape(id, 1);

    let left: SideShape = 'blank';
    let right: SideShape = 'blank';

    if (puzzleType === 'start') {
      left = 'flat';
      right = 'blank';
    } else if (puzzleType === 'end') {
      left = 'blank';
      right = 'flat';
    } else {
      // middle: West(In)=Blank, East(In)=Blank
      left = 'blank';
      right = 'blank';
    }

    return { top, right, bottom, left };
  }, [id, puzzleType]);

  const getHandleStyle = (side: 'left' | 'right') => {
    const shape = side === 'left' ? shapes.left : shapes.right;
    const offset = 14; // tabHeight (8 -> 14)
    const baseMargin = -8; // -ml-2 equivalent

    if (side === 'left') {
      if (shape === 'tab') return { marginLeft: `${baseMargin - offset}px` };
      if (shape === 'blank') return { marginLeft: `${baseMargin + offset}px` };
      return {};
    } else {
      if (shape === 'tab') return { marginRight: `${baseMargin - offset}px` };
      if (shape === 'blank') return { marginRight: `${baseMargin + offset}px` };
      return {};
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'relative group min-w-[320px] p-7 transition-all', // Padding increased to p-7, min-w to 320px
        className,
      )}
      style={{ isolation: 'isolate' }}
    >
      <JigsawBackground
        width={dimensions.width}
        height={dimensions.height}
        shapes={shapes}
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
            {data.description && (
              <p className="text-xs font-medium text-gray-400 leading-relaxed line-clamp-2">
                {data.description}
              </p>
            )}
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
