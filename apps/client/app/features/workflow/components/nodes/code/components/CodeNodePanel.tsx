import { useCallback, useState, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import Editor from '@monaco-editor/react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { CodeNodeData, CodeNodeInput } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';

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

  // ReferencedVariablesControl을 위한 Code Node 어댑터
  const variables = useMemo(() => {
    return (data.inputs || []).map((input) => ({
      name: input.name,
      value_selector: input.source ? input.source.split('.') : [],
    }));
  }, [data.inputs]);

  const handleUpdateVariable = useCallback(
    (
      index: number,
      key: 'name' | 'value_selector',
      value: string | string[],
    ) => {
      const newInputs = [...(data.inputs || [])];
      if (key === 'name') {
        newInputs[index] = { ...newInputs[index], name: value as string };
      } else if (key === 'value_selector') {
        // value는 string[] [노드ID, 변수명]
        const source = (value as string[]).join('.');
        newInputs[index] = { ...newInputs[index], source };
      }
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [data.inputs, nodeId, updateNodeData],
  );

  const handleAddVariable = useCallback(() => {
    const newInput: CodeNodeInput = {
      name: '',
      source: '',
    };
    updateNodeData(nodeId, {
      inputs: [...(data.inputs || []), newInput],
    });
  }, [data.inputs, nodeId, updateNodeData]);

  const handleRemoveVariable = useCallback(
    (index: number) => {
      const newInputs = [...(data.inputs || [])];
      newInputs.splice(index, 1);
      updateNodeData(nodeId, { inputs: newInputs });
    },
    [data.inputs, nodeId, updateNodeData],
  );

  return (
    <div className="flex flex-col h-full gap-2">
      {/* 입력 변수 섹션 */}
      <CollapsibleSection title="입력 변수">
        <div className="flex flex-col gap-3">
          <ReferencedVariablesControl
            variables={variables}
            upstreamNodes={upstreamNodes}
            onUpdate={handleUpdateVariable}
            onAdd={handleAddVariable}
            onRemove={handleRemoveVariable}
            title=""
            description=""
          />

          {data.inputs?.length === 0 && (
            <p className="text-xs text-gray-500 py-2 text-center">
              입력 변수를 추가하여 다른 노드의 데이터를 사용하세요
            </p>
          )}

          {/* 사용 힌트 */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            💡 코드에서{' '}
            <code className="px-1 py-0.5 bg-blue-100 rounded font-mono">
              inputs['변수명']
            </code>{' '}
            으로 사용
          </div>
        </div>
      </CollapsibleSection>

      {/* 코드 에디터 섹션 */}
      <CollapsibleSection title="Python 코드">
        <div className="flex flex-col bg-gray-900 border rounded-lg overflow-hidden h-64">
          <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-400">Editor</h3>
            <button
              onClick={() => setIsExpanded(true)}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="크게 보기"
            >
              <Maximize2 className="w-3 h-3" />
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
                fontSize: 12,
                tabSize: 4,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 고급 설정 */}
      <CollapsibleSection title="고급 설정" defaultOpen={false}>
        <div className="px-2 pb-2 space-y-3">
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
      </CollapsibleSection>

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
