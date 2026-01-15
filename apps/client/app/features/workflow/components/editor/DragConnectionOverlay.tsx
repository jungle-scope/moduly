import React from 'react';
import { useReactFlow } from '@xyflow/react';
import type { AppNode } from '../../types/Nodes';

interface DragConnectionOverlayProps {
  nearestNode: AppNode | null;
  draggedNodePosition: { x: number; y: number } | null;
  isRight: boolean;
}

/**
 * 드래그 연결 미리보기를 위한 커스텀 SVG 오버레이
 * 연결 지점에 원형 파란색 플러스 버튼을 표시합니다
 */
export function DragConnectionOverlay({
  nearestNode,
  draggedNodePosition,
  isRight,
}: DragConnectionOverlayProps) {
  const { getViewport } = useReactFlow();

  if (!nearestNode || !draggedNodePosition) {
    return null;
  }

  const viewport = getViewport();

  // 노드 크기
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 150;
  const LEFT_HANDLE_OFFSET = 0; // 왼쪽 핸들 오프셋
  const RIGHT_HANDLE_OFFSET = 20; // 오른쪽 핸들 오프셋

  // 가장 가까운 노드의 연결 지점 계산 (플러스 버튼이 나타나는 위치)
  const connectionX = isRight
    ? nearestNode.position.x + NODE_WIDTH + RIGHT_HANDLE_OFFSET // 오른쪽: 오른쪽 가장자리 바깥
    : nearestNode.position.x - LEFT_HANDLE_OFFSET; // 왼쪽: 왼쪽 가장자리 바깥
  const connectionY = nearestNode.position.y + NODE_HEIGHT / 2; // Y축 중앙

  const buttonRadius = 12; // 플러스 버튼 원의 반지름 (고정 크기)
  const plusSize = 6; // 플러스 아이콘 크기 (고정 크기)

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
    >
      <g
        transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
      >
        {/* 원형 파란색 버튼 */}
        <circle
          cx={connectionX}
          cy={connectionY}
          r={buttonRadius}
          fill="#3b82f6"
          opacity={1}
        />

        {/* 플러스 아이콘 - 가로선 */}
        <line
          x1={connectionX - plusSize}
          y1={connectionY}
          x2={connectionX + plusSize}
          y2={connectionY}
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* 플러스 아이콘 - 세로선 */}
        <line
          x1={connectionX}
          y1={connectionY - plusSize}
          x2={connectionX}
          y2={connectionY + plusSize}
          stroke="#ffffff"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
