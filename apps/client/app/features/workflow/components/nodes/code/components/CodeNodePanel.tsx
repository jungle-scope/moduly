import { useCallback, useState, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import Editor from '@monaco-editor/react';
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { CodeNodeData, CodeNodeInput } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { getNodeOutputs } from '../../../../utils/getNodeOutputs';

interface CodeNodePanelProps {
  nodeId: string;
  data: CodeNodeData;
}

const DEFAULT_CODE = `def main(inputs):
    # 입력변수를 inputs['변수명']의 형태로 할당
    
    val1 = inputs['변수명1']
    val2 = inputs['변수명2']
    
    total = val1 + val2
    
    # 반드시 딕셔너리 형태로 결과 반환
    return {
        "result": total
    }
`;

export function CodeNodePanel({ nodeId, data }: CodeNodePanelProps) {
  const { updateNodeData, nodes, edges } = useWorkflowStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const upstreamNodes = useMemo(
    () => getUpstreamNodes(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  // 코드 변경 핸들러
  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      updateNodeData(nodeId, { code: value || '' });
    },
    [nodeId, updateNodeData],
  );

  // 입력 변수 추가
  const handleAddInput = useCallback(() => {
    const newInput: CodeNodeInput = {
      name: '',
      source: '',
    };
    updateNodeData(nodeId, {
      inputs: [...(data.inputs || []), newInput],
    });
  }, [nodeId, data.inputs, updateNodeData]);

  // 입력 변수 삭제
  const handleRemoveInput = useCallback(
    (index: number) => {
      const newInputs = data.inputs.filter((_, i) => i !== index);
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [nodeId, data.inputs, updateNodeData],
  );

  // 입력 변수 이름 업데이트
  const handleUpdateInputName = useCallback(
    (index: number, value: string) => {
      const newInputs = [...data.inputs];
      newInputs[index] = { ...newInputs[index], name: value };
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [nodeId, data.inputs, updateNodeData],
  );

  // 소스 노드 변경
  const handleSourceNodeChange = useCallback(
    (index: number, sourceNodeId: string) => {
      const newInputs = [...data.inputs];
      newInputs[index] = { ...newInputs[index], source: `${sourceNodeId}.` };
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [nodeId, data.inputs, updateNodeData],
  );

  // 소스 변수 변경
  const handleSourceVariableChange = useCallback(
    (index: number, variableName: string) => {
      const newInputs = [...data.inputs];
      const currentSource = newInputs[index].source || '';
      const sourceNodeId = currentSource.split('.')[0];
      newInputs[index] = {
        ...newInputs[index],
        source: `${sourceNodeId}.${variableName}`,
      };
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [nodeId, data.inputs, updateNodeData],
  );

  return (
    <div className="flex flex-col h-full">
      {/* 입력 변수 섹션 */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">입력 변수</h3>
          <button
            onClick={handleAddInput}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        </div>

        {/* 입력 변수 목록 */}
        <div className="space-y-3">
          {data.inputs?.map((input, index) => {
            const [sourceNodeId, sourceVariable] = input.source.split('.');
            const selectedSourceNode = nodes.find((n) => n.id === sourceNodeId);

            // 선택된 노드의 출력 목록 가져오기
            const availableOutputs = selectedSourceNode
              ? getNodeOutputs(selectedSourceNode)
              : [];

            return (
              <div
                key={index}
                className="flex flex-col gap-2 rounded border border-gray-200 p-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="변수명 (코드에서 사용)"
                    value={input.name}
                    onChange={(e) =>
                      handleUpdateInputName(index, e.target.value)
                    }
                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleRemoveInput(index)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="삭제"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <select
                    className="h-8 w-1/2 rounded border border-gray-300 px-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                    value={sourceNodeId || ''}
                    onChange={(e) =>
                      handleSourceNodeChange(index, e.target.value)
                    }
                  >
                    <option value="" disabled>
                      노드 선택
                    </option>
                    {upstreamNodes
                      .filter((n) => n.type !== 'note')
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {(n.data as { title?: string })?.title || n.type}
                        </option>
                      ))}
                  </select>

                  <select
                    className={`h-8 w-1/2 rounded border px-2 text-sm focus:border-blue-500 focus:outline-none ${
                      !selectedSourceNode
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : 'border-gray-300 bg-white'
                    }`}
                    value={sourceVariable || ''}
                    onChange={(e) =>
                      handleSourceVariableChange(index, e.target.value)
                    }
                    disabled={!selectedSourceNode}
                  >
                    <option value="">출력 선택</option>
                    {availableOutputs.map((outKey) => (
                      <option key={outKey} value={outKey}>
                        {outKey}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {data.inputs?.length === 0 && (
          <p className="text-xs text-gray-500 py-2 text-center">
            입력 변수를 추가하여 다른 노드의 데이터를 사용하세요
          </p>
        )}

        {/* 사용 힌트 */}
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          💡 코드에서{' '}
          <code className="px-1 py-0.5 bg-blue-100 rounded font-mono">
            inputs['변수명']
          </code>{' '}
          으로 사용
        </div>
      </div>

      {/* 코드 에디터 섹션 */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-200">Python 코드</h3>
          <button
            onClick={() => setIsExpanded(true)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="크게 보기"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={data.code || DEFAULT_CODE}
            onChange={handleCodeChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              tabSize: 4,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'on',
            }}
          />
        </div>
      </div>

      {/* 고급 설정 */}
      <div className="border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700">고급 설정</span>
          {showAdvanced ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">
                타임아웃
                <span className="text-xs text-gray-500 ml-1">(초)</span>
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={data.timeout || 10}
                onChange={(e) =>
                  updateNodeData(nodeId, {
                    timeout: Math.min(
                      30,
                      Math.max(1, parseInt(e.target.value) || 10),
                    ),
                  })
                }
                className="w-20 px-2.5 py-1.5 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500">
              코드 실행 제한 시간 (최대 30초)
            </p>
          </div>
        )}
      </div>

      {/* 확장 모달(코드 에디터) */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="px-6 py-4 bg-gray-800 rounded-t-lg flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Python 코드 편집기
              </h3>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="닫기"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="flex-1 bg-gray-900">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={data.code || DEFAULT_CODE}
                onChange={handleCodeChange}
                options={{
                  minimap: { enabled: true },
                  fontSize: 16,
                  tabSize: 4,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                }}
              />
            </div>

            {/* 모달 푸터 */}
            <div className="px-6 py-4 bg-gray-100 rounded-b-lg border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  💡{' '}
                  <code className="px-2 py-1 bg-gray-200 rounded font-mono text-xs">
                    inputs['변수명']
                  </code>{' '}
                  으로 입력 변수 사용
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
