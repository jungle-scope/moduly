import React, { useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { TemplateNodeData, TemplateVariable } from './TemplateNode';
import { Edge, Node } from '@xyflow/react';
import { toast } from 'sonner';

interface TemplateNodePanelProps {
  nodeId: string;
  data: TemplateNodeData;
}

/**
 * [HELPER] Upstream Node Filtering
 * 현재 노드(targetNodeId)로 들어오는 모든 상위 노드(Ancestors)를 탐색합니다.
 * BFS 방식을 사용하여 직접 연결된 부모뿐만 아니라 그 위의 조상들까지 모두 찾습니다.
 */
const getUpstreamNodes = (
  targetNodeId: string,
  nodes: Node[],
  edges: Edge[],
): Node[] => {
  const upstreamProcess = new Set<string>();
  const visited = new Set<string>();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // 현재 노드로 들어오는 엣지(Incoming Edges)를 찾습니다.
    const incomingEdges = edges.filter((e) => e.target === currentId);

    for (const edge of incomingEdges) {
      if (!visited.has(edge.source)) {
        upstreamProcess.add(edge.source);
        queue.push(edge.source);
      }
    }
  }

  return nodes.filter((n) => upstreamProcess.has(n.id));
};

/**
 * [HELPER] Node Output Recommendation
 * 선택된 노드 타입에 따라, 연결 가능한 출력 변수명 목록을 추천합니다.
 * - StartNode: 사용자가 정의한 입력 변수들
 * - LLM/Template: 'text' (기본 출력)
 */
const getNodeOutputs = (node: Node): string[] => {
  if (!node) return [];

  switch (node.type) {
    case 'startNode':
      // StartNode의 경우 data.variables에 정의된 변수들의 name을 반환
      return (node.data?.variables as any[])?.map((v) => v.name) || [];
    case 'llmNode':
    case 'templateNode':
      return ['text'];
    case 'answerNode':
      return []; // Answer 노드는 출력이 없음
    default:
      return ['result'];
  }
};

export const TemplateNodePanel: React.FC<TemplateNodePanelProps> = ({
  nodeId,
  data,
}) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore();

  // 1. Upstream Nodes (자신보다 상위 노드만 선택 가능)
  // 의존성 배열에 edges를 포함하여 연결 상태가 바뀔 때마다 갱신
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(nodeId, nodes, edges);
  }, [nodeId, nodes, edges]);

  // Handle Template Change
  const handleTemplateChange = (value: string) => {
    updateNodeData(nodeId, { template: value });
  };

  // Handle Variable Add
  const handleAddVariable = () => {
    const newVar: TemplateVariable = {
      name: '',
      value_selector: [],
    };
    updateNodeData(nodeId, {
      variables: [...(data.variables || []), newVar],
    });
  };

  // Handle Variable Remove
  const handleRemoveVariable = (index: number) => {
    const newVars = [...(data.variables || [])];
    newVars.splice(index, 1);
    updateNodeData(nodeId, { variables: newVars });
  };

  // Handle Variable Update (Name)
  const handleUpdateVariable = (
    index: number,
    field: keyof TemplateVariable,
    value: any,
  ) => {
    const newVars = [...(data.variables || [])];
    newVars[index] = { ...newVars[index], [field]: value };
    updateNodeData(nodeId, { variables: newVars });
  };

  // Handle Selector Update (Node ID or Variable Key)
  const handleSelectorUpdate = (
    index: number,
    position: 0 | 1, // 0: NodeID, 1: Key
    value: string,
  ) => {
    const newVars = [...(data.variables || [])];
    // 불변성 유지를 위해 배열 복사
    const currentSelector = [...(newVars[index].value_selector || [])];

    // selector 배열 크기 보장 (최소 [nodeId, key] 구조)
    if (currentSelector.length < 2) {
      currentSelector[0] = currentSelector[0] || '';
      currentSelector[1] = currentSelector[1] || '';
    }

    currentSelector[position] = value;

    // 만약 노드(position 0)가 변경되면, 하위 변수 키(position 1)는 초기화해야 함
    // (이전 노드의 변수명이 남아있으면 안 되므로)
    if (position === 0) {
      currentSelector[1] = '';
    }

    newVars[index] = { ...newVars[index], value_selector: currentSelector };
    updateNodeData(nodeId, { variables: newVars });
  };

  // [UX] Disabled Selector Interaction
  // 노드를 선택하지 않은 상태에서 변수 선택 드롭다운을 클릭했을 때 안내 메시지 표시
  const handleDisabledSelectorClick = () => {
    toast.warning('노드를 먼저 선택해주세요.', {
      position: 'top-center', // 화면 중앙 상단
      duration: 2000,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 2. Variables Mapping (Moved to Top as requested) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">
            Variables
          </label>
          <button
            onClick={handleAddVariable}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add Variable
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-1">
          템플릿에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요.
        </p>

        <div className="flex flex-col gap-3">
          {(data.variables || []).map((variable, index) => {
            const selectedNodeId = variable.value_selector?.[0] || '';
            const selectedVarKey = variable.value_selector?.[1] || '';

            const selectedNode = nodes.find((n) => n.id === selectedNodeId);
            const availableOutputs = selectedNode
              ? getNodeOutputs(selectedNode)
              : [];

            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    Var #{index + 1}
                  </span>
                  <button
                    onClick={() => handleRemoveVariable(index)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>

                {/* 
                  [LAYOUT] Single Row Layout
                  - flex-row로 변경하여 한 줄에 배치
                  - gap-2로 요소 간 간격 조정
                */}
                <div className="flex flex-row gap-2 items-center">
                  {/* (1) Variable Name Input */}
                  <div className="flex-[2]">
                    <input
                      type="text"
                      className="w-full rounded border border-gray-300 p-1.5 text-xs"
                      placeholder="변수명"
                      value={variable.name}
                      onChange={(e) =>
                        handleUpdateVariable(index, 'name', e.target.value)
                      }
                    />
                  </div>

                  {/* (2) Node Selection Dropdown */}
                  <div className="flex-[3]">
                    <select
                      className="w-full rounded border border-gray-300 p-1.5 text-xs truncate"
                      value={selectedNodeId}
                      onChange={(e) =>
                        handleSelectorUpdate(index, 0, e.target.value)
                      }
                    >
                      <option value="">노드 선택</option>
                      {upstreamNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.data.title || n.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* (3) Output Variable Selection Dropdown */}
                  {/* 
                     [UX] Disabled Wrapper 
                     disabled 상태일 때 클릭 이벤트를 감지하기 위해 절대 위치의 투명한 div(Overlay)를 사용합니다.
                     Select 요소가 disabled이면 이벤트를 받지 않으므로, 그 위에 Overlay를 씌워 클릭을 가로챕니다.
                  */}
                  <div className="flex-[3] relative">
                    <select
                      className={`w-full rounded border p-1.5 text-xs truncate ${
                        !selectedNodeId
                          ? 'bg-gray-100 text-gray-400 border-gray-200'
                          : 'border-gray-300 bg-white'
                      }`}
                      value={selectedVarKey}
                      onChange={(e) =>
                        handleSelectorUpdate(index, 1, e.target.value)
                      }
                      disabled={!selectedNodeId}
                    >
                      <option value="">
                        {!selectedNodeId ? '변수 선택' : '출력 선택'}
                      </option>
                      {availableOutputs.map((outKey) => (
                        <option key={outKey} value={outKey}>
                          {outKey}
                        </option>
                      ))}
                    </select>

                    {/* Overlay for disabled state */}
                    {!selectedNodeId && (
                      <div
                        className="absolute inset-0 z-10 cursor-not-allowed"
                        onClick={handleDisabledSelectorClick}
                        title="노드를 먼저 선택해주세요" // Hover 시 툴팁 표시
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {(data.variables || []).length === 0 && (
            <div className="text-center text-xs text-gray-400 py-4 border border-dashed border-gray-300 rounded">
              추가된 변수가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 1. Template Editor (Moved to Bottom) */}
      <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
        <label className="text-sm font-semibold text-gray-700">Template</label>
        <p className="text-xs text-gray-500">
          Jinja2 문법을 사용하여 템플릿을 작성하세요. 설정한 변수는{' '}
          <code className="bg-gray-100 px-1 rounded text-gray-700">
            {`{{ variable_name }}`}
          </code>{' '}
          형태로 템플릿 내에 삽입될 수 있습니다.
        </p>
        <textarea
          className="w-full min-h-[150px] rounded border border-gray-300 p-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
          value={data.template || ''}
          onChange={(e) => handleTemplateChange(e.target.value)}
          placeholder="예: 안녕하세요, {{ user_name }}님! 요청하신 결과는 다음과 같습니다: {{ result_text }}"
        />
      </div>
    </div>
  );
};

