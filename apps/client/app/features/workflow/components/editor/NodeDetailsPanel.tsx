import { X, Pencil, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { nodes, updateNodeData } = useWorkflowStore();

  // 제목 편집 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  // 선택된 노드 찾기
  const selectedNode = nodes.find((n) => n.id === nodeId);
  // 노드 정의 찾기 (아이콘, 설명 등)
  const nodeDef = selectedNode
    ? getNodeDefinitionByType(selectedNode.type || '')
    : null;

  // 노드 변경 시 편집 제목 초기화
  useEffect(() => {
    if (selectedNode) {
      setEditTitle(
        (selectedNode.data.title as string) || nodeDef?.name || 'Node',
      );
    }
  }, [selectedNode, nodeDef]);

  // 편집 시작 시 입력창 포커스
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  // 제목 저장 핸들러
  const handleSaveTitle = () => {
    if (nodeId && editTitle.trim()) {
      updateNodeData(nodeId, { title: editTitle.trim() });
      setIsEditing(false);
    } else {
      // Revert if empty
      setEditTitle(
        (selectedNode?.data.title as string) || nodeDef?.name || 'Node',
      );
      setIsEditing(false);
    }
  };

  // 키 입력 핸들러 (Enter: 저장, Escape: 취소)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditTitle(
        (selectedNode?.data.title as string) || nodeDef?.name || 'Node',
      );
      setIsEditing(false);
    }
  };

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
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`flex items-center justify-center w-8 h-8 min-w-[32px] rounded text-white font-bold text-sm ${nodeDef?.color || 'bg-gray-500'}`}
          >
            {nodeDef?.icon || '📦'}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                // 입력 필드: 제목 수정
                <input
                  ref={titleInputRef}
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveTitle}
                  className="w-full text-lg font-semibold text-gray-900 border-b-2 border-primary-500 focus:outline-none px-1 py-0.5 bg-transparent"
                />
                // 저장 버튼
                <button
                  onClick={handleSaveTitle}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              // 제목 표시 (클릭 시 편집 모드 전환)
              <div
                className="group flex items-center gap-2 cursor-pointer"
                onClick={() => setIsEditing(true)}
              >
                <h2
                  className="text-lg font-semibold text-gray-900 truncate max-w-[200px]"
                  title={
                    (selectedNode.data.title as string) ||
                    nodeDef?.name ||
                    'Node'
                  }
                >
                  {(selectedNode.data.title as string) ||
                    nodeDef?.name ||
                    'Node'}
                </h2>
                <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <p className="text-xs text-gray-500 truncate">
              {nodeDef?.description || 'No description available.'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-gray-500" />
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
