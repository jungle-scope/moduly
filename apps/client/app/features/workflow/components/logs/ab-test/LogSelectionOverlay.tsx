import React from 'react';

interface LogSelectionOverlayProps {
  selectionTarget: 'A' | 'B' | null;
}

export const LogSelectionOverlay = ({
  selectionTarget,
}: LogSelectionOverlayProps) => {
  if (!selectionTarget) return null;

  return (
    <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-2 z-20 opacity-95 shadow-md flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
      <span>👇 목록에서 </span>
      <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full">
        Run {selectionTarget}
      </span>
      <span> 로 사용할 실행 기록을 클릭하세요</span>
    </div>
  );
};
