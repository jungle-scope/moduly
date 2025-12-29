import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import { TemplateNodeData, TemplateVariable } from '../../../../types/Nodes';
import { Edge, Node } from '@xyflow/react';
import { toast } from 'sonner';

interface TemplateNodePanelProps {
  nodeId: string;
  data: TemplateNodeData;
}

/**
 * [HELPER] Upstream Node Filtering
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
 */
const getNodeOutputs = (node: Node): string[] => {
  if (!node) return [];

  switch (node.type) {
    case 'startNode':
      return (node.data?.variables as any[])?.map((v) => v.name) || [];
    case 'llmNode':
    case 'templateNode':
      return ['text'];
    case 'answerNode':
      return [];
    default:
      return ['result'];
  }
};

/**
 * [NOTE] Get Caret Coordinates
 * Textarea의 커서 위치(top, left)를 계산하기 위해 Mirror Div를 사용합니다.
 */
const getCaretCoordinates = (
  element: HTMLTextAreaElement,
  position: number,
) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);

  // Copy styles
  Array.from(style).forEach((prop) => {
    div.style.setProperty(prop, style.getPropertyValue(prop));
  });

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';
  
  // Textarea의 내용을 복사하되, 커서 위치까지만 span으로 감싸서 위치 계산
  const textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = textContent;
  span.id = 'caret-span';
  
  div.textContent = textContent; // span을 쓰지 않고 textContent로 넣은 뒤 마지막에 span을 추가하는 방식 등 여러 방법이 있지만
  // 가장 간단하게는:
  div.innerHTML = textContent.replace(/\n/g, '<br>') + '<span id="caret-marker">|</span>';

  document.body.appendChild(div);
  
  const marker = div.querySelector('#caret-marker');
  const coordinates = {
    top: marker ? marker.getBoundingClientRect().top - div.getBoundingClientRect().top : 0,
    left: marker ? marker.getBoundingClientRect().left - div.getBoundingClientRect().left : 0,
    height: parseInt(style.lineHeight) || 20, // fallback line height
  };

  document.body.removeChild(div);
  return coordinates;
};


export const TemplateNodePanel: React.FC<TemplateNodePanelProps> = ({
  nodeId,
  data,
}) => {
  const { nodes, edges, updateNodeData } = useWorkflowStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [cursorIdx, setCursorIdx] = useState(0);

  // 1. Upstream Nodes
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

  // Handle Variable Update
  const handleUpdateVariable = (
    index: number,
    field: keyof TemplateVariable,
    value: any,
  ) => {
    const newVars = [...(data.variables || [])];
    newVars[index] = { ...newVars[index], [field]: value };
    updateNodeData(nodeId, { variables: newVars });
  };

  // Handle Selector Update
  const handleSelectorUpdate = (
    index: number,
    position: 0 | 1,
    value: string,
  ) => {
    const newVars = [...(data.variables || [])];
    const currentSelector = [...(newVars[index].value_selector || [])];

    if (currentSelector.length < 2) {
      currentSelector[0] = currentSelector[0] || '';
      currentSelector[1] = currentSelector[1] || '';
    }

    currentSelector[position] = value;
    if (position === 0) {
      currentSelector[1] = '';
    }

    newVars[index] = { ...newVars[index], value_selector: currentSelector };
    updateNodeData(nodeId, { variables: newVars });
  };

  // Handle Disabled Selector Click
  const handleDisabledSelectorClick = () => {
    toast.warning('노드를 먼저 선택해주세요.', {
      position: 'top-center',
      duration: 2000,
    });
  };

  // [AUTOCOMPLETE] Check for '{{' triggers
  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const value = target.value;
    const selectionEnd = target.selectionEnd;
    setCursorIdx(selectionEnd);

    // 커서 앞의 2글자가 {{ 인지 확인
    if (value.substring(selectionEnd - 2, selectionEnd) === '{{') {
       // 이미 {{ }} 닫혀있는지 체크는 생략하고 단순 트리거 구현
       // 위치 계산
       const coords = getCaretCoordinates(target, selectionEnd);
       setSuggestionPos({
         top: coords.top + coords.height + 10, // 조금 아래
         left: coords.left,
       });
       setShowSuggestions(true);
    } else {
       // 입력 중이 아니면 숨김 (단, 단순 이동은 유지하고 싶으면 로직 개선 필요)
       // 여기서는 단순하게 {{ 직후가 아니면 닫는 걸로 (MVP) -> 실제론 좀 더 정교해야 함
       // 예: {{ 입력 후 user_typing... 일 때도 유지되어야 함.
       // 일단 {{ 바로 뒤에서만 뜨게 하고, 변수 선택하면 닫히게 구현
       if (showSuggestions && !value.substring(0, selectionEnd).endsWith('{{')) {
         // setShowSuggestions(false); // Typing 중에는 유지해야 할 수도 있음.
         // MVP: {{ 입력 직후에만 띄우고, 다른 키 입력시 닫거나 필터링.
         // 여기서는 간단히 {{ 가 사라지거나 멀어지면 닫음
         const lastOpen = value.lastIndexOf('{{', selectionEnd);
         const lastClose = value.lastIndexOf('}}', selectionEnd);
         if (lastOpen === -1 || (lastClose > lastOpen)) {
            setShowSuggestions(false);
         }
       }
    }
  };

  // [AUTOCOMPLETE] Insert Variable
  const insertVariable = (varName: string) => {
    const currentValue = data.template || '';
    // 현재 커서 위치 (handleKeyUp에서 저장된 cursorIdx 사용하거나 ref 사용)
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionEnd = textarea.selectionEnd;
    
    // {{ 뒤에 삽입한다고 가정 (혹은 {{ 까지 포함해서 교체)
    // 현재 로직: 사용자가 {{ 를 입력해서 트리거 됨. 
    // -> {{ varName }} }} 형태로 되지 않게 주의.
    
    // 가장 가까운 {{ 찾기
    const lastOpen = currentValue.lastIndexOf('{{', selectionEnd);
    if (lastOpen !== -1) {
        const prefix = currentValue.substring(0, lastOpen);
        const suffix = currentValue.substring(selectionEnd);
        
        // {{ varName }} 형태로 완성
        const newValue = `${prefix}{{ ${varName} }}${suffix}`;
        handleTemplateChange(newValue);
        setShowSuggestions(false);
        
        // 커서 이동 (React re-render 후 적용을 위해 setTimeout)
        setTimeout(() => {
            const newCursorPos = prefix.length + varName.length + 5; // {{_var_}} Length
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }
  };


  // [VALIDATION] Check for unregistered variables
  const validationErrors = useMemo(() => {
    const template = data.template || '';
    const registeredNames = new Set((data.variables || []).map(v => v.name));
    const errors: string[] = [];

    // Regex to find {{ variable }}
    const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
      const varName = match[1];
      if (!registeredNames.has(varName)) {
        errors.push(varName);
      }
    }
    return Array.from(new Set(errors)); // 중복 제거
  }, [data.template, data.variables]);


  return (
    <div className="flex flex-col gap-6">
      {/* 2. Variables Mapping */}
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
                          {(n.data.title as string) || n.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* (3) Output Selection */}
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
                    {!selectedNodeId && (
                      <div
                        className="absolute inset-0 z-10 cursor-not-allowed"
                        onClick={handleDisabledSelectorClick}
                        title="노드를 먼저 선택해주세요"
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

      {/* 1. Template Editor */}
      <div className="flex flex-col gap-2 pt-4 border-t border-gray-100 relative">
        <label className="text-sm font-semibold text-gray-700">Template</label>
        <p className="text-xs text-gray-500">
          Jinja2 문법을 사용하여 템플릿을 작성하세요. 설정한 변수는{' '}
          <code className="bg-gray-100 px-1 rounded text-gray-700">
            {`{{ variable_name }}`}
          </code>{' '}
          형태로 템플릿 내에 삽입될 수 있습니다.
        </p>
        
        <div className="relative w-full">
            <textarea
              ref={textareaRef}
              className="w-full min-h-[150px] rounded border border-gray-300 p-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
              value={data.template || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              onKeyUp={handleKeyUp}
              onClick={() => setShowSuggestions(false)} // 클릭 시 닫음
              placeholder="예: 안녕하세요, {{ user_name }}님!"
            />

            {/* [AUTOCOMPLETE] Dropdown Overlay */}
            {showSuggestions && (
                <div 
                    className="absolute bg-white border border-gray-200 shadow-lg rounded z-50 w-48 max-h-40 overflow-y-auto"
                    style={{ 
                        top: suggestionPos.top, 
                        left: suggestionPos.left,
                        marginTop: '4px'
                    }}
                >
                    {(data.variables || []).length > 0 ? (
                        (data.variables || []).map((v, i) => (
                            <div
                                key={i}
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer"
                                onClick={() => insertVariable(v.name)}
                            >
                                {v.name || '(unnamed)'}
                            </div>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                            위에서 변수를 먼저 등록해주세요.
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* [VALIDATION] Warning Block */}
        {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-xs">
                <p className="font-semibold mb-1">⚠️ 등록되지 않은 변수가 감지되었습니다:</p>
                <ul className="list-disc list-inside">
                    {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                    ))}
                </ul>
                <p className="mt-1 text-[10px] text-red-500">
                    오류: 등록되지 않은 변수입니다. Variables 섹션에 정의된 변수만 사용할 수 있습니다.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
