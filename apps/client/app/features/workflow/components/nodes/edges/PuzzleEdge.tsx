import React from 'react';
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  Position,
  useStore,
} from '@xyflow/react';

// BaseNode와 공통 상수
const TAB_SIZE = 34;
const TAB_HEIGHT = 14;

// 퍼즐 탭(돌기) 모양을 그리는 함수
// 엣지의 끝부분에 부착되어 물리적인 결합 느낌을 줍니다.
const PuzzleTab = ({
  x,
  y,
  position, // 탭이 연결되는 핸들의 위치 (Source=Right, Target=Left)
  color = '#d1d5db',
}: {
  x: number;
  y: number;
  position: Position;
  color?: string;
}) => {
  // 시각적 로직:
  // Source 노드(오른쪽 함몰) --- [ 탭 ] --- 엣지 선 --- [ 탭 ] --- Target 노드(왼쪽 함몰)
  // 탭은 엣지의 헤드 부분 역할을 합니다.

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* 
        회전 로직: 
        Source(오른쪽 핸들)에 연결될 때는 탭이 왼쪽(노드 안쪽)을 향해야 합니다.
        Target(왼쪽 핸들)에 연결될 때는 탭이 오른쪽(노드 안쪽)을 향해야 합니다.
        
        React Flow 'position' prop은 노드 상의 핸들 위치를 알려줍니다.
        Source Handle은 Position.Right.
        Target Handle은 Position.Left.
      */}
      <PuzzleTabShape
        orientation={position === Position.Right ? 'left' : 'right'}
        color={color}
      />
    </g>
  );
};

const PuzzleTabShape = ({
  orientation,
  color,
}: {
  orientation: 'left' | 'right';
  color: string;
}) => {
  // 퍼즐 탭 모양의 경로(Path)를 그립니다.
  // BaseNode의 함몰(Hole) 곡선과 일치하도록 구성합니다.

  // 탭 너비와 높이는 BaseNode와 동일하게 설정
  // TAB_SIZE = 34, TAB_HEIGHT = 14

  // 오른쪽을 향하는 탭 경로 (Target 노드에 결합)
  // 탭의 뾰족한 부분이 오른쪽(x+)을 향함
  const pathRight = `
    M 0 ${-TAB_SIZE / 2}
    C 0 ${-TAB_SIZE / 6}, ${TAB_HEIGHT} ${-TAB_SIZE / 2}, ${TAB_HEIGHT} 0
    C ${TAB_HEIGHT} ${TAB_SIZE / 2}, 0 ${TAB_SIZE / 6}, 0 ${TAB_SIZE / 2}
    Z
  `;

  // 왼쪽을 향하는 탭 경로 (Source 노드에 결합)
  // 탭의 뾰족한 부분이 왼쪽(x-)을 향함
  const pathLeft = `
    M 0 ${-TAB_SIZE / 2}
    C 0 ${-TAB_SIZE / 6}, ${-TAB_HEIGHT} ${-TAB_SIZE / 2}, ${-TAB_HEIGHT} 0
    C ${-TAB_HEIGHT} ${TAB_SIZE / 2}, 0 ${TAB_SIZE / 6}, 0 ${TAB_SIZE / 2}
    Z
  `;

  return (
    <path
      d={orientation === 'right' ? pathRight : pathLeft}
      fill={color}
      stroke={color} // 엣지와 동일한 색상의 테두리
      strokeWidth={1}
    />
  );
};

export const PuzzleEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // 노드 선택 상태 확인
  // useStore를 사용하여 노드의 선택 상태를 가져옵니다.
  const isSourceSelected = useStore((s: any) => {
    // nodeLookup이 존재하면 사용 (React Flow 12)
    if (s.nodeLookup) {
      return s.nodeLookup.get(source)?.selected;
    }
    // 하위 호환성 (구버전)
    return s.nodeInternals?.get(source)?.selected;
  });

  const isTargetSelected = useStore((s: any) => {
    if (s.nodeLookup) {
      return s.nodeLookup.get(target)?.selected;
    }
    return s.nodeInternals?.get(target)?.selected;
  });

  // 엣지 자체가 선택되었거나, 연결된 노드 중 하나가 선택된 경우 파란색 활성화
  const isActive = selected || isSourceSelected || isTargetSelected;

  // 색상 및 두께 설정
  // 기본: 회색(#d1d5db), 활성: 파란색(#3b82f6)
  const edgeColor = isActive ? '#3b82f6' : '#d1d5db';
  const edgeWidth = 10; // 원형 점을 명확히 보여주기 위해 두께 설정

  return (
    <>
      {/* 
        엣지 경로 (브릿지 몸통)
        두껍게 그려서 퍼즐 조각이 연결된 느낌을 줍니다.
      */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: edgeWidth,
          stroke: edgeColor,
          strokeLinecap: 'round', // 원형 점을 만들기 위해 round 캡 사용
          strokeDasharray: '0 20', // 간격 넓힘 (0 15 -> 0 25)
          // transition 스타일 추가
          transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
        }}
        className="react-flow__edge-path"
      />
    </>
  );
};
