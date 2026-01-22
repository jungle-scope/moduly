'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  TouchpadIcon,
  MousePointerIcon,
  NoteIcon,
  LayoutIcon,
  FullscreenIcon,
  ChevronDownIcon,
  ArrowsInIcon,
} from '../nodes/icons';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { type NoteNode } from '../../types/Nodes';

interface BottomPanelProps {
  onCenterNodes: () => void;
  isPanelOpen?: boolean;
  onOpenAppSearch?: () => void;
}

export default function BottomPanel({
  onCenterNodes,
  isPanelOpen = false,
  onOpenAppSearch,
}: BottomPanelProps) {
  const {
    interactiveMode,
    setInteractiveMode,
    nodes,
    setNodes,
    toggleFullscreen,
    isFullscreen,
  } = useWorkflowStore();
  const {
    screenToFlowPosition,
    zoomIn,
    zoomOut,
    setViewport,
    getViewport,
    fitView,
  } = useReactFlow();

  // 한 번에 하나의 모달만 열리도록 관리하는 상태
  const [openModal, setOpenModal] = useState<'interactive' | 'zoom' | null>(
    null,
  );
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [notePosition, setNotePosition] = useState({ x: 0, y: 0 });
  const [currentZoom, setCurrentZoom] = useState(100);

  // 외부 클릭 감지를 위한 모달 Refs
  const interactiveModalRef = useRef<HTMLDivElement>(null);
  const zoomModalRef = useRef<HTMLDivElement>(null);

  // 뷰포트 변경 시 줌 레벨 업데이트
  useEffect(() => {
    const updateZoom = () => {
      const viewport = getViewport();
      // 0.8 줌을 100%로 표시 (실제 줌 / 0.8 * 100)
      setCurrentZoom(Math.round((viewport.zoom / 0.8) * 100));
    };

    updateZoom();
    // 주기적으로 줌 업데이트
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [getViewport]);

  // 외부 클릭 시 모달 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openModal) return;

      const target = event.target as Node;

      // 클릭이 모달 내부인지 확인
      const isInsideInteractive =
        interactiveModalRef.current &&
        interactiveModalRef.current.contains(target);
      const isInsideZoom =
        zoomModalRef.current && zoomModalRef.current.contains(target);

      // 모달 내부 클릭이 아니면 현재 모달 닫기
      if (!isInsideInteractive && !isInsideZoom) {
        setOpenModal(null);
      }
    };

    if (openModal) {
      // 모든 클릭을 감지하기 위해 캡처 단계 사용
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true);
      };
    }
  }, [openModal]);

  const handleInteractiveToggle = useCallback(() => {
    setOpenModal((prev) => (prev === 'interactive' ? null : 'interactive'));
  }, []);

  const handleAddNote = useCallback(() => {
    setIsAddingNote(true);
    setOpenModal(null); // 열린 모달 닫기
  }, []);

  useEffect(() => {
    if (!isAddingNote) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 미리보기를 제한하기 위해 ReactFlow 래퍼 가져오기
      const reactFlowWrapper = document.querySelector('.react-flow');
      if (!reactFlowWrapper) {
        setNotePosition({ x: e.clientX, y: e.clientY });
        return;
      }

      const rect = reactFlowWrapper.getBoundingClientRect();

      // 위치를 캔버스 경계로 제한
      const x = Math.max(rect.left, Math.min(e.clientX, rect.right));
      const y = Math.max(rect.top, Math.min(e.clientY, rect.bottom));

      setNotePosition({ x, y });
    };

    const handleClick = (e: MouseEvent) => {
      // UI 요소 클릭 방지
      const target = e.target as HTMLElement;
      if (target.closest('.pointer-events-auto')) {
        return;
      }

      // 화면 좌표를 캔버스 좌표로 변환
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // 투영된 위치에 사용자 정의 노트 타입으로 노트 생성
      const newNote: NoteNode = {
        id: `note-${Date.now()}`,
        type: 'note',
        data: { content: '', title: '메모' },
        position,
        style: {
          width: 300,
          height: 100,
        },
      };

      setNodes([...nodes, newNote]);
      setIsAddingNote(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddingNote(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAddingNote, nodes, setNodes, screenToFlowPosition]);

  const handleFullscreen = useCallback(() => {
    toggleFullscreen();
    setOpenModal(null); // 열린 모달 닫기
  }, [toggleFullscreen]);

  const selectInteractiveMode = useCallback(
    (mode: 'mouse' | 'touchpad') => {
      setInteractiveMode(mode);
      setOpenModal(null);
    },
    [setInteractiveMode],
  );

  const toggleZoomModal = useCallback(() => {
    setOpenModal((prev) => (prev === 'zoom' ? null : 'zoom'));
  }, []);

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleZoomToPercent = useCallback(
    (percent: number) => {
      const viewport = getViewport();
      setViewport({ ...viewport, zoom: percent / 100 });
      setOpenModal(null);
    },
    [getViewport, setViewport],
  );

  const handleAutoFit = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
    setOpenModal(null);
  }, [fitView]);

  return (
    <>
      {/* 커서를 따라다니는 노트 미리보기 */}
      {isAddingNote && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: notePosition.x + 10,
            top: notePosition.y + 10,
          }}
        >
          <div className="bg-amber-50 border-2 border-yellow-400 rounded-lg shadow-xl p-3 w-[300px] min-h-[100px]">
            <div className="text-sm text-gray-400 italic min-h-[60px]">
              클릭하여 입력...
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 툴바 */}
      <div
        className="absolute bottom-6 z-10 pointer-events-auto transition-all duration-300"
        style={{
          left: '50%',
          transform: isPanelOpen
            ? 'translateX(calc(-50% - 100px))'
            : 'translateX(-50%)',
        }}
      >
        <div className="flex items-center gap-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1.5">
          {/* 인터랙티브 설정 */}
          <div className="relative" ref={interactiveModalRef}>
            <button
              onClick={handleInteractiveToggle}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Interactive settings"
            >
              {interactiveMode === 'touchpad' ? (
                <TouchpadIcon className="w-4 h-4 text-gray-600" />
              ) : (
                <MousePointerIcon className="w-4 h-4 text-gray-600" />
              )}
            </button>

            {/* 인터랙티브 모달 */}
            {openModal === 'interactive' && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-auto">
                <div className="bg-white rounded-lg shadow-2xl border border-gray-200 p-6 w-[480px]">
                  <h3 className="text-lg font-semibold mb-4">Interactive</h3>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Mouse-friendly */}
                    <button
                      onClick={() => selectInteractiveMode('mouse')}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        interactiveMode === 'mouse'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 mb-3 flex items-center justify-center">
                          <svg
                            className={`w-12 h-12 ${
                              interactiveMode === 'mouse'
                                ? 'text-blue-600'
                                : 'text-gray-600'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                            />
                          </svg>
                        </div>
                        <h4
                          className={`font-semibold mb-1 ${
                            interactiveMode === 'mouse'
                              ? 'text-blue-600'
                              : 'text-gray-700'
                          }`}
                        >
                          Mouse-friendly
                        </h4>
                        <p
                          className={`text-xs ${
                            interactiveMode === 'mouse'
                              ? 'text-blue-600'
                              : 'text-gray-600'
                          }`}
                        >
                          Left-click to drag the canvas and zoom with the scroll
                          wheel
                        </p>
                      </div>
                    </button>

                    {/* Touchpad-friendly */}
                    <button
                      onClick={() => selectInteractiveMode('touchpad')}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        interactiveMode === 'touchpad'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 mb-3 flex items-center justify-center">
                          <svg
                            className={`w-12 h-12 ${
                              interactiveMode === 'touchpad'
                                ? 'text-blue-600'
                                : 'text-gray-600'
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <rect
                              x="4"
                              y="6"
                              width="16"
                              height="12"
                              rx="2"
                              strokeWidth={1.5}
                            />
                            <line
                              x1="8"
                              y1="15"
                              x2="16"
                              y2="15"
                              strokeWidth={1}
                            />
                          </svg>
                        </div>
                        <h4
                          className={`font-semibold mb-1 ${
                            interactiveMode === 'touchpad'
                              ? 'text-blue-600'
                              : 'text-gray-700'
                          }`}
                        >
                          Touchpad-friendly
                        </h4>
                        <p
                          className={`text-xs ${
                            interactiveMode === 'touchpad'
                              ? 'text-blue-600'
                              : 'text-gray-600'
                          }`}
                        >
                          Drag with two fingers in the same direction, and zoom
                          with a pinch or spread gesture
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* 줌 컨트롤 */}
          <div className="relative" ref={zoomModalRef}>
            <button
              onClick={toggleZoomModal}
              className="px-3 py-1.5 flex items-center gap-1 text-gray-700 hover:bg-gray-100 rounded transition-colors min-w-[60px] justify-center"
            >
              <span className="text-sm font-medium">{currentZoom}%</span>
              <ChevronDownIcon className="w-3 h-3" />
            </button>

            {/* 줌 모달 */}
            {openModal === 'zoom' && (
              <div className="absolute bottom-full left-0 mb-2 w-[180px] bg-white rounded-lg shadow-2xl border border-gray-200 py-2">
                <button
                  onClick={handleZoomOut}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom out
                </button>
                <button
                  onClick={handleZoomIn}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom in
                </button>
                <div className="my-1 h-px bg-gray-200" />
                <button
                  onClick={handleAutoFit}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Auto-fit
                </button>
                <div className="my-1 h-px bg-gray-200" />
                <button
                  onClick={() => handleZoomToPercent(50)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom to 50%
                </button>
                <button
                  onClick={() => handleZoomToPercent(100)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom to 100%
                </button>
                <button
                  onClick={() => handleZoomToPercent(150)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom to 150%
                </button>
                <button
                  onClick={() => handleZoomToPercent(200)}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Zoom to 200%
                </button>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-gray-200" />

          {/* 노트 추가 */}
          <button
            onClick={handleAddNote}
            className={`p-2 hover:bg-gray-100 rounded transition-colors ${
              isAddingNote ? 'bg-blue-100' : ''
            }`}
            title="메모 추가"
          >
            <NoteIcon className="w-4 h-4 text-gray-600" />
          </button>

          <div className="w-px h-6 bg-gray-200" />

          {/* 레이아웃 최적화 */}
          <button
            onClick={onCenterNodes}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="레이아웃 최적화"
          >
            <LayoutIcon className="w-4 h-4 text-gray-600" />
          </button>

          <div className="w-px h-6 bg-gray-200" />

          {/* 전체화면 */}
          <button
            onClick={handleFullscreen}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title={isFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {isFullscreen ? (
              <ArrowsInIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <FullscreenIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>
    </>
  );
}
