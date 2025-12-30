import { useEffect, useRef } from 'react';
import { XIcon } from '../icons';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { getNodeDefinitionByType } from '../../config/nodeRegistry';

interface NodeDetailsPanelProps {
  nodeId: string | null;
  onClose: () => void;
  children: React.ReactNode;
  header?: {
    icon?: string;
    title?: string;
    description?: string;
  };
}

/**
 * NodeDetailsPanel
 * 노드 선택 시 우측에 나타나는 세부 설정 패널
 */
export default function NodeDetailsPanel({
  nodeId,
  onClose,
  children,
  header,
}: NodeDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { nodes } = useWorkflowStore();

  // 선택된 노드 찾기
  const selectedNode = nodes.find((n) => n.id === nodeId);
  // 노드 정의 찾기 (아이콘, 설명 등)
  const nodeDef = selectedNode
    ? getNodeDefinitionByType(selectedNode.type || '')
    : null;

  // 외부(캔버스) 클릭 시 패널 닫기
  useEffect(() => {
    if (!nodeId) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // 패널 내부 클릭 시 닫지 않음
      if (panelRef.current?.contains(target)) {
        return;
      }

      // 노드 클릭 시 닫지 않음 (노드 클릭 핸들러가 관리하도록 함)
      if (target.closest('.react-flow__node')) {
        return;
      }

      // 하단 패널이나 다른 UI 요소를 클릭하면 닫지 않음
      if (target.closest('.pointer-events-auto')) {
        return;
      }

      // 캔버스 클릭 시 패널 닫기
      if (target.closest('.react-flow__pane')) {
        onClose();
      }
    };

    // 열 때 즉시 닫히는 것을 방지하기 위해 약간의 지연 추가
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [nodeId, onClose]);

  if (!nodeId || !selectedNode) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
    >
      {/* 패널 헤더 */}
      {/* NOTE: [LLM] header prop으로 노드별 아이콘/텍스트를 표시하도록 확장 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded text-white font-bold text-sm ${nodeDef?.color || 'bg-gray-500'}`}
          >
            {nodeDef?.icon || '📦'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {selectedNode.data.title || nodeDef?.name || 'Node'}
            </h2>
            <p className="text-xs text-gray-500">
              {nodeDef?.description || 'No description available.'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close panel"
        >
          <XIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* 패널 콘텐츠 - 현재는 children을 표시하며, 현재 사용에서는 보통 비어 있음 */}
      {/* 향후: 노드 유형에 따라 여기에 특정 속성 편집기 추가 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}

        {/* children이 없을 경우 대체 콘텐츠 */}
        {!children && (
          <div className="text-sm text-gray-500">
            Configure this node in the canvas or add property controls here.
          </div>
        )}
      </div>
    </div>
  );
}
