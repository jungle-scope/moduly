import { useCallback, useState, useMemo } from 'react';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import Editor from '@monaco-editor/react';
import { Maximize2, Minimize2, Wand2, AlertTriangle } from 'lucide-react';
import { CodeNodeData, CodeNodeInput } from '../../../../types/Nodes';
import { getUpstreamNodes } from '../../../../utils/getUpstreamNodes';
import { CollapsibleSection } from '../../ui/CollapsibleSection';
import { ReferencedVariablesControl } from '../../ui/ReferencedVariablesControl';
import { CodeWizardModal } from '../../../modals/CodeWizardModal';

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
  const [isCodeWizardOpen, setIsCodeWizardOpen] = useState(false);

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

  // 코드 마법사에서 생성된 코드 적용
  const handleApplyCode = useCallback(
    (generatedCode: string) => {
      updateNodeData(nodeId, { code: generatedCode });
    },
    [nodeId, updateNodeData],
  );

  // 입력변수 이름 목록 (코드 마법사용)
  const inputVariableNames = useMemo(() => {
    return (data.inputs || []).map(input => input.name).filter(Boolean);
  }, [data.inputs]);

  // [VALIDATION] 불완전한 입력변수 (이름은 있지만 source가 비어있는 경우)
  const incompleteVariables = useMemo(() => {
    const incomplete: string[] = [];
    for (const input of data.inputs || []) {
      const name = (input.name || '').trim();
      const source = (input.source || '').trim();
      if (name && !source) {
        incomplete.push(name);
      }
    }
    return incomplete;
  }, [data.inputs]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* 입력변수 섹션 */}
      <CollapsibleSection title="입력변수" showDivider>
        <div className="flex flex-col gap-3">
          <ReferencedVariablesControl
            variables={variables}
            upstreamNodes={upstreamNodes}
            onUpdate={handleUpdateVariable}
            onAdd={handleAddVariable}
            onRemove={handleRemoveVariable}
            title=""
            description="코드에서 사용할 변수를 정의하고, 이전 노드의 출력값과 연결하세요."
          />
          {/* 사용 힌트 */}
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            💡 코드에서{' '}
            <code className="px-1 py-0.5 bg-blue-100 rounded font-mono">
              inputs['변수명']
            </code>{' '}
            으로 사용
          </div>
          
          {/* [불완전한 변수 경고] */}
          {incompleteVariables.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 text-orange-700 text-xs">
              <p className="font-semibold mb-1">
                ⚠️ 변수의 노드/출력이 선택되지 않았습니다:
              </p>
              <ul className="list-disc list-inside">
                {incompleteVariables.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
              <p className="mt-1 text-[10px] text-orange-500">
                실행 시 빈 값으로 대체됩니다.
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 코드 에디터 섹션 */}
      <CollapsibleSection title="Python 코드" showDivider>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500">
             실행할 Python 코드를 작성하세요. 입력변수는 <code>inputs</code> 딕셔너리로 접근할 수 있습니다.
          </p>
          <div className="flex flex-col bg-gray-900 border rounded-lg overflow-hidden h-64">
          <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-medium text-gray-400">Editor</h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsCodeWizardOpen(true)}
                className="px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-gray-700 rounded transition-colors flex items-center gap-1"
                title="코드 마법사"
              >
                <Wand2 className="w-3 h-3" />
                마법사
              </button>
              <button
                onClick={() => setIsExpanded(true)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                title="크게 보기"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
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
      </div>
      </CollapsibleSection>

      {/* 고급 설정 */}
      <CollapsibleSection title="고급 설정" defaultOpen={false} showDivider>
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
                  으로 입력변수 사용
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


      {/* 코드 마법사 모달 */}
      <CodeWizardModal
        isOpen={isCodeWizardOpen}
        onClose={() => setIsCodeWizardOpen(false)}
        inputVariables={inputVariableNames}
        onApply={handleApplyCode}
      />
    </div>
  );
}
