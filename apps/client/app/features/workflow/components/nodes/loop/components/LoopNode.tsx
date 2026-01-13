import { memo, useState, useCallback, useMemo } from 'react';
import { NodeProps, Node, Edge } from '@xyflow/react';
import { BaseNode } from '../../BaseNode';
import { Repeat, Plus } from 'lucide-react';
import { useWorkflowStore } from '../../../../store/useWorkflowStore';
import { LoopInnerCanvas } from './LoopInnerCanvas';
import { NodeSelector } from '../../../editor/NodeSelector';
import { nanoid } from 'nanoid';
import { LoopNode as LoopNodeType } from '../../../../types/Nodes';

export const LoopNode = memo(
  ({ id, data, selected }: NodeProps<LoopNodeType>) => {
    const { updateNodeData, clearInnerNodeSelection } = useWorkflowStore();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);

    // 내부 그래프 데이터 (없으면 초기화)
    const subNodes = useMemo(
      () => (data.subGraph?.nodes as Node[]) || [],
      [data.subGraph?.nodes],
    );
    const subEdges = useMemo(
      () => (data.subGraph?.edges as Edge[]) || [],
      [data.subGraph?.edges],
    );

    const isEmpty = subNodes.length === 0;

    // 노드 추가 핸들러
    const handleAddNode = useCallback(
      (type: string, nodeDef: any) => {
        const newNodeId = `${type}-${nanoid(6)}`;

        // 최신 subNodes 상태 가져오기
        const currentSubNodes = (data.subGraph?.nodes as Node[]) || [];
        const currentSubEdges = (data.subGraph?.edges as Edge[]) || [];

        // 간단한 자동 레이아웃: 기존 노드들 우측에 배치
        const lastNode = currentSubNodes[currentSubNodes.length - 1];
        const newPosition = lastNode
          ? { x: lastNode.position.x + 250, y: lastNode.position.y }
          : { x: 50, y: 50 };

        const newNode: Node = {
          id: newNodeId,
          type: nodeDef.type,
          position: newPosition,
          data: nodeDef.defaultData ? nodeDef.defaultData() : {},
        };

        const newNodes = [...currentSubNodes, newNode];

        // 엣지 연결
        const newEdges = [...currentSubEdges];
        if (lastNode) {
          const newEdge: Edge = {
            id: `e-${lastNode.id}-${newNode.id}`,
            source: lastNode.id,
            target: newNode.id,
            type: 'puzzle',
          };
          newEdges.push(newEdge);
        }

        updateNodeData(id, {
          subGraph: {
            nodes: newNodes,
            edges: newEdges,
          },
        });

        setIsPopoverOpen(false);
      },
      [id, data.subGraph, updateNodeData],
    );

    // 내부 컨텐츠에 따른 가로 길이 계산
    const containerStyle = useMemo(() => {
      if (isEmpty) return { width: 300, height: 200 }; // 기본 크기

      // 가장 오른쪽 노드의 끝 위치 계산
      let maxX = 0;
      subNodes.forEach((n) => {
        const nodeRight = n.position.x + 300; // 대략적인 노드 폭
        if (nodeRight > maxX) maxX = nodeRight;
      });

      const padding = 100;
      const width = Math.max(300, maxX + padding);

      return { width: width, height: 400 }; // 높이는 일단 고정
    }, [subNodes, isEmpty]);

    // Loop 노드 자체 클릭 핸들러 (내부 캔버스 외부 영역)
    const handleContainerClick = useCallback(
      (e: React.MouseEvent) => {
        // 내부 캔버스 영역이 아닌 곳을 클릭했을 때만 처리
        const target = e.target as HTMLElement;

        // 내부 캔버스나 버튼 클릭은 무시
        if (
          target.closest('.loop-inner-canvas') ||
          target.closest('button') ||
          target.closest('.node-selector')
        ) {
          return;
        }

        // 내부 노드 선택 해제 (Loop 노드 자체를 선택)
        clearInnerNodeSelection();
      },
      [clearInnerNodeSelection],
    );

    return (
      <BaseNode
        id={id}
        data={data as any}
        selected={selected}
        icon={<Repeat className="w-5 h-5 text-white" />}
        iconColor="#8b5cf6"
        className="transition-all duration-300"
      >
        <div
          className="relative bg-gray-50 rounded-lg border border-dashed border-gray-300 overflow-visible transition-all duration-300"
          style={{ width: containerStyle.width, height: containerStyle.height }}
          onClick={handleContainerClick}
        >
          {isEmpty ? (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="relative">
                <button
                  onClick={() => setIsPopoverOpen(true)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 gap-2"
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
                    <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 z-40 shadow-xl rounded-xl node-selector">
                      <NodeSelector onSelect={handleAddNode} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="loop-inner-canvas w-full h-full">
                <LoopInnerCanvas
                  nodes={subNodes}
                  edges={subEdges}
                  parentNodeId={id}
                />
              </div>
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
                      <div className="absolute right-0 top-full mt-2 z-40 shadow-xl rounded-xl node-selector">
                        <NodeSelector onSelect={handleAddNode} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </BaseNode>
    );
  },
);
