import React from 'react';
import { ConnectionLineComponentProps, getBezierPath } from '@xyflow/react';

export const CustomConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionLineStyle,
}: ConnectionLineComponentProps) => {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <g>
      <defs>
        <marker
          id="connection-line-arrow"
          markerWidth="16"
          markerHeight="16"
          refX="13"
          refY="8"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <polyline
            points="4,2 13,8 4,14"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke="#9ca3af"
        strokeWidth={2}
        strokeLinecap="round"
        markerEnd="url(#connection-line-arrow)"
        style={connectionLineStyle}
      />
    </g>
  );
};
