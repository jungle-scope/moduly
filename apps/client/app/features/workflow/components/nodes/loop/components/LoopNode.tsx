import type { FC } from 'react';
import { memo, useState, useCallback, useMemo } from 'react';
import {
  Background,
  Handle,
  NodeResizer,
  Position,
  useViewport,
  type NodeProps,
} from '@xyflow/react';
import { Repeat, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { NodeSelector } from '../../../editor/NodeSelector';
import { nanoid } from 'nanoid';
import type { LoopNode as LoopNodeType } from '../../../../types/Nodes';

const MIN_WIDTH = 400;
const MIN_HEIGHT = 250;

const Node: FC<NodeProps<LoopNodeType>> = ({ id, data, selected }) => {
  const { zoom } = useViewport();
  const { nodes, edges, setNodes, setEdges } = useWorkflowStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Ensure all required fields have default values
  const nodeData = useMemo(
    () => ({
      ...data,
      loop_key: data.loop_key || '',
      inputs: data.inputs || [],
      outputs: data.outputs || [],
      parallel_mode: data.parallel_mode ?? false,
      error_strategy: data.error_strategy || 'end',
      flatten_output: data.flatten_output ?? true,
      _children: data._children || [],
    }),
    [data],
  );

  // 자식 노드들 조회
  const children = useMemo(
    () => nodes.filter((n) => n.parentId === id),
    [nodes, id],
  );
  const isEmpty = children.length === 0;

  // 노드 추가 핸들러
  const handleAddNode = useCallback(
    (type: string, nodeDef: any) => {
      const newNodeId = `${type}-${nanoid(6)}`;

      // 마지막 자식 노드 위치 계산
      const lastChild = children[children.length - 1];
      const newPosition = lastChild
        ? { x: lastChild.position.x + 350, y: lastChild.position.y }
        : { x: 50, y: 50 };

      // 새 노드 생성 (parentId 설정)
      const newNode = {
        id: newNodeId,
        type: nodeDef.type,
        position: newPosition,
        data: nodeDef.defaultData ? nodeDef.defaultData() : {},
        parentId: id,
        extent: 'parent' as const,
      };

      // 자동 연결 (마지막 자식과 연결)
      const newEdges = [...edges];
      if (lastChild) {
        newEdges.push({
          id: `e-${lastChild.id}-${newNode.id}`,
          source: lastChild.id,
          target: newNode.id,
          type: 'puzzle',
        });
      }

      // Loop 노드의 _children 업데이트
      const updatedNodes = nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              _children: [...(nodeData._children || []), newNodeId],
            },
          };
        }
        return node;
      });

      setNodes([...updatedNodes, newNode as any]);
      setEdges(newEdges as any);
      setIsPopoverOpen(false);
    },
    [id, nodes, edges, nodeData._children, children, setNodes, setEdges],
  );

  return (
    <div
      className={cn(
        'relative h-full min-h-[250px] w-full min-w-[400px] rounded-2xl bg-white border-2',
        selected ? 'border-blue-500' : 'border-gray-300',
      )}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white !-right-1.5"
      />

      {/* NodeResizer for manual resizing */}
      <NodeResizer
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        isVisible={selected}
        lineClassName="!border-blue-500"
        handleClassName="h-3 w-3 bg-blue-500 rounded-full border-2 border-white"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center gap-3 px-4 bg-white rounded-t-2xl border-b border-gray-200 z-10">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#8b5cf6' }}
        >
          <Repeat className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {nodeData.title || '반복'}
          </div>
        </div>
      </div>

      {/* Container - starts below header */}
      <div className="absolute top-14 left-4 right-4 bottom-4">
        <div className="w-full h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 overflow-hidden relative">
          {/* Dify-style background for visual grouping */}
          <Background
            id={`loop-background-${id}`}
            className="!z-0"
            gap={[14 / zoom, 14 / zoom]}
            size={2 / zoom}
            color="var(--color-gray-300)"
          />

          {isEmpty ? (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="relative">
                <button
                  onClick={() => setIsPopoverOpen(true)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-gray-300 bg-white shadow-sm hover:bg-gray-50 h-9 px-4 py-2 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  노드 추가
                </button>
                {isPopoverOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsPopoverOpen(false)}
                    />
                    <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-40 shadow-xl rounded-xl">
                      <NodeSelector onSelect={handleAddNode} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="absolute top-4 right-4 z-10">
              <div className="relative">
                <button
                  onClick={() => setIsPopoverOpen(true)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium shadow-sm h-8 w-8 bg-white border border-gray-200 hover:bg-gray-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {isPopoverOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setIsPopoverOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-40 shadow-xl rounded-xl">
                      <NodeSelector onSelect={handleAddNode} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const LoopNode = memo(Node);
