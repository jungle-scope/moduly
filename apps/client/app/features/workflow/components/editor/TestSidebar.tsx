import React, { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore } from '../../store/useWorkflowStore';
import { workflowApi } from '../../api/workflowApi';
import { knowledgeApi } from '@/app/features/knowledge/api/knowledgeApi';
import {
  X,
  Play,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { StartNodeData, WorkflowVariable } from '../../types/Nodes';

export function TestSidebar() {
  const {
    isTestPanelOpen,
    toggleTestPanel,
    nodes,
    activeWorkflowId,
    setNodes,
    updateNodeData,
  } = useWorkflowStore();
  const { setCenter } = useReactFlow();

  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [nodeResults, setNodeResults] = useState<
    Array<{ nodeId: string; nodeType: string; output: any }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  // Start Node 찾기 및 변수 초기화
  const startNode = nodes.find(
    (n) =>
      n.type === 'startNode' ||
      n.type === 'webhookTrigger' ||
      n.type === 'scheduleTrigger',
  );

  let variables: WorkflowVariable[] = [];
  if (startNode?.type === 'startNode') {
    variables = (startNode.data as StartNodeData)?.variables || [];
  } else if (startNode?.type === 'webhookTrigger') {
    // Webhook의 경우 JSON payload 입력
    variables = [
      {
        id: '__json_payload__',
        name: '__json_payload__',
        label: 'JSON Payload (Body)',
        type: 'paragraph',
        required: true,
        placeholder: '{"issue": {"key": "TEST-123"}}',
      },
    ];
  }

  // 패널이 열릴 때 초기화
  useEffect(() => {
    if (isTestPanelOpen) {
      const initial: Record<string, any> = {};
      variables.forEach((v) => {
        if (v.type === 'number') {
          initial[v.name] = 0;
        } else if (v.type === 'checkbox') {
          initial[v.name] = false;
        } else if (v.type === 'select') {
          initial[v.name] = v.options?.[0]?.value || '';
        } else if (v.type === 'file') {
          initial[v.name] = null;
        } else {
          initial[v.name] = '';
        }
      });
      setInputs(initial);
      setFiles({});
      setExecutionResult(null);
      setNodeResults([]);
      setError(null);
    }
  }, [isTestPanelOpen]);

  if (!isTestPanelOpen) return null;

  const handleChange = (name: string, value: any) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
  };

  const handleExecute = async () => {
    if (!activeWorkflowId) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setNodeResults([]);
    setError(null);

    try {
      const hasFiles = Object.values(files).some((file) => file !== null);
      let finalInputs: Record<string, any> = { ...inputs };

      // Webhook인 경우 JSON 파싱
      if (startNode?.type === 'webhookTrigger') {
        try {
          const rawJson = inputs['__json_payload__'];
          finalInputs = JSON.parse(rawJson);
        } catch {
          toast.error('유효하지 않은 JSON 형식입니다.');
          setError('JSON 파싱 실패');
          setIsExecuting(false);
          return;
        }
      }

      // 파일 업로드 처리
      if (hasFiles) {
        setIsUploading(true);
        try {
          for (const [key, file] of Object.entries(files)) {
            if (file) {
              const presignedData = await knowledgeApi.getPresignedUploadUrl(
                file.name,
                file.type || 'application/octet-stream',
              );

              await knowledgeApi.uploadToS3(
                presignedData.upload_url,
                file,
                file.type || 'application/octet-stream',
              );

              const s3Url = presignedData.upload_url.split('?')[0];
              finalInputs[key] = s3Url;
            }
          }
        } catch (uploadError: any) {
          toast.error(`파일 업로드 실패: ${uploadError.message}`);
          setError('파일 업로드 실패');
          setIsUploading(false);
          setIsExecuting(false);
          return;
        }
        setIsUploading(false);
      }

      // 1. 초기화: 모든 노드 상태 초기화
      const initialNodes = nodes.map((node) => ({
        ...node,
        data: { ...node.data, status: 'idle' },
      })) as unknown as any[];
      setNodes(initialNodes);

      let finalResult: any = null;

      // 2. 스트리밍 실행
      await workflowApi.executeWorkflowStream(
        activeWorkflowId,
        finalInputs,
        async (event) => {
          // 시각적 피드백을 위한 지연
          await new Promise((resolve) => setTimeout(resolve, 500));

          const { type, data } = event;

          if (type === 'node_start') {
            updateNodeData(data.node_id, { status: 'running' });

            // 실행 중인 노드로 화면 중심 이동 및 줌인
            const latestNodes = useWorkflowStore.getState().nodes;
            const currentNode = latestNodes.find((n) => n.id === data.node_id);
            if (currentNode) {
              setCenter(
                currentNode.position.x +
                  (currentNode.measured?.width || 200) / 2,
                currentNode.position.y +
                  (currentNode.measured?.height || 100) / 2,
                { zoom: 1.2, duration: 800 },
              );
            }
          } else if (type === 'node_finish') {
            updateNodeData(data.node_id, { status: 'success' });

            // 노드 실행 완료 토스트
            toast.success(`[${data.node_type}] 실행 완료`, {
              description: `결과: ${JSON.stringify(data.output).slice(0, 50)}${JSON.stringify(data.output).length > 50 ? '...' : ''}`,
              duration: 2000,
            });

            // 노드 결과 누적
            setNodeResults((prev) => [
              ...prev,
              {
                nodeId: data.node_id,
                nodeType: data.node_type,
                output: data.output,
              },
            ]);
          } else if (type === 'workflow_finish') {
            finalResult = data;
          } else if (type === 'error') {
            if (data.node_id) {
              updateNodeData(data.node_id, { status: 'failure' });
            }
            toast.error(`모듈 실행 실패: ${data.message}`);
            throw new Error(data.message);
          }
        },
      );

      // 최종 결과 저장
      if (finalResult) {
        setExecutionResult(finalResult);
        toast.success('모듈이 실행되었습니다.');
      }
    } catch (err: any) {
      console.error('Execution failed:', err);
      setError(err.message || '실행 중 오류가 발생했습니다.');
      toast.error('실행 실패');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setExecutionResult(null);
    setNodeResults([]);
    setError(null);
  };

  return (
    <div className="absolute top-24 right-0 bottom-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col animate-in slide-in-from-right duration-200 dark:bg-gray-900 dark:border-gray-800">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Play className="w-5 h-5 text-blue-600" />
          테스트 실행
        </h2>
        <button
          onClick={toggleTestPanel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isExecuting && nodeResults.length > 0 ? (
          /* Execution Progress - Show node results as they come in */
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <h3 className="text-sm font-medium">실행 중...</h3>
            </div>
            {nodeResults.map((result, index) => (
              <div
                key={`${result.nodeId}-${index}`}
                className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="px-4 py-2 bg-green-50 border-b border-green-200 flex items-center gap-2 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-800 dark:text-green-400">
                    [{result.nodeType}] 완료
                  </span>
                </div>
                <div className="p-3 bg-white overflow-x-auto dark:bg-gray-900 max-h-40">
                  <pre className="text-xs text-gray-600 font-mono dark:text-gray-300">
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : !executionResult && !error ? (
          /* Input Form */
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4 dark:text-gray-200">
                입력 변수 설정
              </h3>

              {variables.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg dark:bg-gray-800">
                  입력 변수가 없는 모듈입니다.
                  <br />
                  바로 실행할 수 있습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  {variables.map((variable) => (
                    <div key={variable.id}>
                      {variable.type === 'checkbox' ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inputs[variable.name] || false}
                            onChange={(e) =>
                              handleChange(variable.name, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {variable.label || variable.name}
                            {variable.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </span>
                        </label>
                      ) : variable.type === 'select' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                            {variable.label || variable.name}
                            {variable.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          <select
                            value={inputs[variable.name] || ''}
                            onChange={(e) =>
                              handleChange(variable.name, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700"
                          >
                            {variable.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : variable.type === 'file' ? (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                            {variable.label || variable.name}
                            {variable.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setFiles((prev) => ({
                                ...prev,
                                [variable.name]: file,
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                            {variable.label || variable.name}
                            {variable.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          {variable.type === 'paragraph' ? (
                            <textarea
                              value={inputs[variable.name] || ''}
                              onChange={(e) =>
                                handleChange(variable.name, e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] dark:bg-gray-800 dark:border-gray-700"
                              placeholder={variable.placeholder}
                            />
                          ) : (
                            <input
                              type={
                                variable.type === 'number' ? 'number' : 'text'
                              }
                              value={inputs[variable.name] || ''}
                              onChange={(e) =>
                                handleChange(
                                  variable.name,
                                  variable.type === 'number'
                                    ? Number(e.target.value)
                                    : e.target.value,
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                              placeholder={variable.placeholder}
                            />
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Execution Result */
          <div className="space-y-6">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">
                    실행 실패
                  </h3>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">
                    실행 성공
                  </h3>
                  <p className="text-sm text-green-600 mt-1">
                    모듈이 성공적으로 실행되었습니다.
                  </p>
                </div>
              </div>
            )}

            {executionResult && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3 dark:text-gray-200">
                  노드별 실행 결과
                </h3>
                <div className="space-y-3">
                  {Object.entries(executionResult).map(
                    ([nodeId, output]: [string, any]) => (
                      <div
                        key={nodeId}
                        className="border border-gray-200 rounded-lg overflow-hidden dark:border-gray-700"
                      >
                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:border-gray-700">
                          {nodeId}
                        </div>
                        <div className="p-3 bg-white overflow-x-auto dark:bg-gray-900">
                          <pre className="text-xs text-gray-600 font-mono dark:text-gray-300">
                            {JSON.stringify(output, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
        {!executionResult && !error ? (
          <button
            onClick={handleExecute}
            disabled={isExecuting || isUploading}
            className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {isExecuting || isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isUploading ? '파일 업로드 중...' : '실행 중...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                실행하기
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            다시 테스트하기
          </button>
        )}
      </div>
    </div>
  );
}
