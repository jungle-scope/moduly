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
  const tabSize = 34; // 탭 너비 (24 -> 34 -> 24: 유저 요청으로 축소)
  const tabHeight = 14; // 탭 높이 (8 -> 14 -> 12: 유저 요청으로 축소)

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

    // Initial measurement to prevent invisible node on first render
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
          // Fallback for older browsers or edge cases
          setDimensions({
            width: (entry.contentRect.width || 0) + 56, // p-7 * 2 = 56
            height: (entry.contentRect.height || 0) + 56,
          });
          // Check offsetWidth as final fallback
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
      right = 'tab'; // 돌출형 (출력)
    } else if (puzzleType === 'end') {
      left = 'blank'; // 함몰형 (입력 받음)
      right = 'flat';
    } else {
      // middle: West(In)=Blank, East(Out)=Tab
      left = 'blank'; // 함몰형 (입력 받음)
      right = 'tab'; // 돌출형 (출력)
    }

    return {
      top: 'flat' as SideShape,
      right: 'flat' as SideShape,
      bottom: 'flat' as SideShape,
      left: 'flat' as SideShape,
    };
  }, [id, puzzleType]);

  const getHandleStyle = (side: 'left' | 'right') => {
    const shape = side === 'left' ? shapes.left : shapes.right;
    const tabHeight = 14; // 탭의 길이

    // 핸들 위치 조정:
    // - 돌출형(tab): 바깥쪽 끝부분에 위치 (-14px)
    // - 함몰형(blank): 돌출형보다 더 바깥쪽에 위치 (-20px)
    // - 평평형(flat): 노드 경계선에 위치 (0)
    if (side === 'left') {
      if (shape === 'tab') return { left: `-${tabHeight}px` }; // 돌출: -14px
      if (shape === 'blank') return { left: `-${tabHeight + 6}px` }; // 함몰: -20px (더 바깥쪽)
      return { left: '-20px' }; // 평평: 테두리 선 중앙
    } else {
      if (shape === 'tab') return { right: `-${tabHeight}px` }; // 돌출: -14px
      if (shape === 'blank') return { right: `-${tabHeight + 6}px` }; // 함몰: -20px (더 바깥쪽)
      return { right: '-20px' }; // 평평: 테두리 선 중앙
    }
  };

  return (
    <div
      ref={ref}
      className={cn(
        'relative group min-w-[320px] p-7 transition-all', // Padding increased to p-7, min-w to 320px
        className,
      )}
      style={{ isolation: 'isolate', overflow: 'visible' }}
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
            {/* Description removed per user request for centering title */}
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
