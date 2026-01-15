import { format } from 'date-fns';
import { JsonDataDisplay } from './JsonDataDisplay';
import { ko } from 'date-fns/locale';
import {
  WorkflowRun,
  WorkflowNodeRun,
} from '@/app/features/workflow/types/Api';
import {
  CheckCircle2,
  XCircle,
  Clock,
  BrainCircuit,
  PlayCircle,
  AlertCircle,
  Play,
  MessageSquare,
  GitFork,
  Code,
  Globe,
  Webhook,
  Calendar,
  Database,
  Slack,
  Mail,
  Sparkles,
  FileText,
  Bot,
  ChevronDown,
  Upload,
  Download,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { LogExecutionPath } from './LogExecutionPath';
import { LogTokenAnalysis } from './LogTokenAnalysis';

interface LogDetailProps {
  run: WorkflowRun;
  onCompareClick?: () => void;
  compactMode?: boolean;
}

// Node type to Korean label and icon mapping
const getNodeDisplayInfo = (
  nodeType: string,
): { label: string; icon: React.ReactNode; color: string } => {
  const mapping: Record<
    string,
    { label: string; icon: React.ReactNode; color: string }
  > = {
    startNode: {
      label: '시작',
      icon: <Play className="w-4 h-4" />,
      color: 'text-green-600 bg-green-50',
    },
    answerNode: {
      label: '응답',
      icon: <MessageSquare className="w-4 h-4" />,
      color: 'text-blue-600 bg-blue-50',
    },
    llmNode: {
      label: 'LLM',
      icon: <Sparkles className="w-4 h-4" />,
      color: 'text-purple-600 bg-purple-50',
    },
    conditionNode: {
      label: '조건',
      icon: <GitFork className="w-4 h-4" />,
      color: 'text-amber-600 bg-amber-50',
    },
    codeNode: {
      label: '코드',
      icon: <Code className="w-4 h-4" />,
      color: 'text-gray-600 bg-gray-50',
    },
    httpRequestNode: {
      label: 'HTTP 요청',
      icon: <Globe className="w-4 h-4" />,
      color: 'text-cyan-600 bg-cyan-50',
    },
    webhookTriggerNode: {
      label: '웹훅 트리거',
      icon: <Webhook className="w-4 h-4" />,
      color: 'text-indigo-600 bg-indigo-50',
    },
    scheduleTriggerNode: {
      label: '스케줄 트리거',
      icon: <Calendar className="w-4 h-4" />,
      color: 'text-orange-600 bg-orange-50',
    },
    knowledgeNode: {
      label: '지식 검색',
      icon: <Database className="w-4 h-4" />,
      color: 'text-emerald-600 bg-emerald-50',
    },
    slackPostNode: {
      label: 'Slack 전송',
      icon: <Slack className="w-4 h-4" />,
      color: 'text-pink-600 bg-pink-50',
    },
    emailNode: {
      label: '이메일',
      icon: <Mail className="w-4 h-4" />,
      color: 'text-red-600 bg-red-50',
    },
    workflowNode: {
      label: '워크플로우 호출',
      icon: <Bot className="w-4 h-4" />,
      color: 'text-violet-600 bg-violet-50',
    },
    templateNode: {
      label: '템플릿',
      icon: <FileText className="w-4 h-4" />,
      color: 'text-teal-600 bg-teal-50',
    },
  };

  return (
    mapping[nodeType] || {
      label: nodeType,
      icon: <BrainCircuit className="w-4 h-4" />,
      color: 'text-gray-600 bg-gray-50',
    }
  );
};

// 접었다 펼치기 가능한 섹션 컴포넌트
const CollapsibleSection = ({
  title,
  icon,
  defaultOpen = true,
  bgColor = 'gray',
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  bgColor?: 'amber' | 'gray';
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    amber: 'bg-amber-50 border-amber-200',
    gray: 'bg-gray-50 border-gray-200',
  };

  const headerColorClasses = {
    amber: 'text-amber-700',
    gray: 'text-gray-700',
  };

  return (
    <div className={`rounded-lg border ${colorClasses[bgColor]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-80 transition-all"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h4 className={`font-semibold text-sm ${headerColorClasses[bgColor]}`}>
            {title}
          </h4>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${headerColorClasses[bgColor]} ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};

// 노드 설정 섹션 (NodeOptionsDisplay를 CollapsibleSection으로 감싸지 않고, 내부에서 직접 처리)
const NodeOptionsSection = ({
  nodeType,
  options,
}: {
  nodeType: string;
  options: Record<string, any>;
}) => {
  return (
    <CollapsibleSection
      title="실행 시점 노드 설정"
      icon={<span>⚙️</span>}
      bgColor="amber"
      defaultOpen={true}
    >
      <div className="pt-2">
        <NodeOptionsDisplay nodeType={nodeType} options={options} />
      </div>
    </CollapsibleSection>
  );
};

// 입력 데이터 섹션
const InputDataSection = ({ data }: { data: any }) => {
  return (
    <CollapsibleSection
      title="입력 데이터"
      icon={<Upload className="w-4 h-4" />}
      bgColor="gray"
      defaultOpen={true}
    >
      <div className="bg-white rounded border border-gray-200 p-4 max-h-96 overflow-y-auto">
        <JsonDataDisplay data={data} initiallyExpanded={true} />
      </div>
    </CollapsibleSection>
  );
};

// 출력 데이터 섹션
const OutputDataSection = ({ data }: { data: any }) => {
  return (
    <CollapsibleSection
      title="출력 데이터"
      icon={<Download className="w-4 h-4" />}
      bgColor="gray"
      defaultOpen={true}
    >
      <div className="bg-white rounded border border-gray-200 p-4 max-h-96 overflow-y-auto">
        <JsonDataDisplay data={data} initiallyExpanded={true} />
      </div>
    </CollapsibleSection>
  );
};

// 옵션 필드 아이템 컴포넌트
const OptionFieldItem = ({
  label,
  value,
  type,
  isEmpty,
}: {
  label: string;
  value: any;
  type?: 'text' | 'code' | 'list' | 'json' | 'variables-table';
  isEmpty: boolean;
}) => {
  return (
    <div className="text-xs">
      <span className="font-semibold text-gray-700 block mb-1">{label}</span>
      {isEmpty ? (
        <div className="bg-white rounded border border-gray-200 p-2 min-h-[32px]" />
      ) : type === 'code' ? (
        <pre className="bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
          {value}
        </pre>
      ) : type === 'list' && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1">
          {value.map((v: any, i: number) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
            >
              {v.name || v.id || JSON.stringify(v)}
            </span>
          ))}
        </div>
      ) : type === 'variables-table' && Array.isArray(value) ? (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">변수명</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">표시명</th>
                <th className="px-2 py-1.5 text-left font-semibold text-gray-700 border-b">타입</th>
                <th className="px-2 py-1.5 text-center font-semibold text-gray-700 border-b">필수</th>
              </tr>
            </thead>
            <tbody>
              {value.map((v: any, i: number) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 font-mono text-gray-700">{v.name}</td>
                  <td className="px-2 py-1.5 text-gray-700">{v.label}</td>
                  <td className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                      {v.type}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {v.required ? (
                      <span className="text-red-600 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === 'json' ? (
        <pre className="bg-white rounded border border-gray-200 p-2 overflow-x-auto max-h-24 overflow-y-auto font-mono text-gray-600">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        // text 타입과 기본 타입(모델명 등) 모두 동일한 스타일 적용 (흰색 박스)
        <div className="bg-white rounded border border-gray-200 p-2 max-h-32 overflow-y-auto">
          <p className="text-gray-700 whitespace-pre-wrap font-mono text-[11px]">
            {String(value)}
          </p>
        </div>
      )}
    </div>
  );
};

// 노드 타입별 설정 표시 컴포넌트
const NodeOptionsDisplay = ({
  nodeType,
  options,
}: {
  nodeType: string;
  options: Record<string, any>;
}) => {
  // 제외할 공통 필드
  const excludeFields = ['title', 'description', 'status'];

  // 값이 비어있는지 확인하는 헬퍼
  const isEmpty = (value: any): boolean => {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
  };

  // 노드 타입별 표시할 필드 구성 (행 단위로 그룹화)
  const getDisplayConfig = (type: string) => {
    type FieldConfig = { key: string; label: string; type?: 'text' | 'code' | 'list' | 'json' | 'variables-table' };
    const configs: Record<string, { label: string; rows: FieldConfig[][] }> = {
      llmNode: {
        label: 'LLM 설정',
        rows: [
          [
            { key: 'model_id', label: '모델' },
            { key: 'fallback_model_id', label: '폴백 모델' },
          ],
          [{ key: 'system_prompt', label: '시스템 프롬프트', type: 'text' }],
          [{ key: 'user_prompt', label: '사용자 프롬프트', type: 'text' }],
          [{ key: 'assistant_prompt', label: '어시스턴트 프롬프트', type: 'text' }],
          [{ key: 'parameters', label: '파라미터', type: 'json' }],
          [{ key: 'knowledgeBases', label: '지식 베이스', type: 'list' }],
        ],
      },
      codeNode: {
        label: '코드 설정',
        rows: [
          [{ key: 'code', label: '코드', type: 'code' }],
          [
            { key: 'timeout', label: '타임아웃 (초)' },
            { key: 'inputs', label: '입력 변수 매핑', type: 'json' },
          ],
        ],
      },
      httpRequestNode: {
        label: 'HTTP 요청 설정',
        rows: [
          [
            { key: 'method', label: '메서드' },
            { key: 'url', label: 'URL' },
          ],
          [{ key: 'headers', label: '헤더', type: 'json' }],
          [{ key: 'body', label: '바디', type: 'text' }],
          [
            { key: 'timeout', label: '타임아웃 (ms)' },
            { key: 'authType', label: '인증 타입' },
          ],
        ],
      },
      conditionNode: {
        label: '조건 설정',
        rows: [
          [{ key: 'cases', label: '조건 케이스', type: 'json' }],
          [{ key: 'logical_operator', label: '논리 연산자' }],
        ],
      },
      templateNode: {
        label: '템플릿 설정',
        rows: [
          [{ key: 'template', label: '템플릿', type: 'text' }],
          [{ key: 'referenced_variables', label: '참조 변수', type: 'json' }],
        ],
      },
      startNode: {
        label: '시작 노드 설정',
        rows: [
          [{ key: 'trigger_type', label: '트리거 타입' }],
          [{ key: 'variables', label: '입력 변수', type: 'variables-table' }],
        ],
      },
      answerNode: {
        label: 'Answer 노드 설정',
        rows: [
          [{ key: 'outputs', label: '출력 변수', type: 'json' }],
        ],
      },
      webhookTriggerNode: {
        label: 'Webhook 트리거 설정',
        rows: [
          [{ key: 'provider', label: 'Provider' }],
          [{ key: 'variable_mappings', label: '변수 매핑', type: 'json' }],
        ],
      },
      mailNode: {
        label: 'Mail 노드 설정',
        rows: [
          [
            { key: 'provider', label: 'Provider' },
            { key: 'email', label: '이메일' },
          ],
          [
            { key: 'folder', label: '폴더' },
            { key: 'max_results', label: '최대 결과' },
          ],
          [{ key: 'keyword', label: '검색 키워드' }],
          [{ key: 'sender', label: '발신자 필터' }],
          [{ key: 'subject', label: '제목 필터' }],
          [
            { key: 'unread_only', label: '읽지 않은 메일만' },
            { key: 'mark_as_read', label: '읽음 표시' },
          ],
        ],
      },
      workflowNode: {
        label: 'Workflow 노드 설정',
        rows: [
          [
            { key: 'workflowId', label: '워크플로우 ID' },
            { key: 'appId', label: '앱 ID' },
          ],
          [{ key: 'inputs', label: '입력 매핑', type: 'json' }],
        ],
      },
      fileExtractionNode: {
        label: 'File Extraction 노드 설정',
        rows: [
          [{ key: 'referenced_variables', label: '참조 변수', type: 'json' }],
        ],
      },
      githubNode: {
        label: 'GitHub 노드 설정',
        rows: [
          [
            { key: 'action', label: '액션' },
            { key: 'pr_number', label: 'PR 번호' },
          ],
          [
            { key: 'repo_owner', label: '저장소 소유자' },
            { key: 'repo_name', label: '저장소 이름' },
          ],
          [{ key: 'comment_body', label: '댓글 내용', type: 'text' }],
        ],
      },
      scheduleTriggerNode: {
        label: 'Schedule 트리거 설정',
        rows: [
          [
            { key: 'cron_expression', label: 'Cron 표현식' },
            { key: 'timezone', label: '타임존' },
          ],
        ],
      },
      loopNode: {
        label: 'Loop 노드 설정',
        rows: [
          [
            { key: 'loop_key', label: '반복 대상 키' },
            { key: 'max_iterations', label: '최대 반복' },
          ],
          [
            { key: 'parallel_mode', label: '병렬 모드' },
            { key: 'error_strategy', label: '에러 전략' },
            { key: 'flatten_output', label: '출력 평탄화' },
          ],
          [
            { key: 'inputs', label: '입력 매핑', type: 'json' },
            { key: 'outputs', label: '출력 매핑', type: 'json' },
          ],
        ],
      },
    };
    return configs[type] || null;
  };

  const config = getDisplayConfig(nodeType);

  // 설정이 없으면 필터링된 JSON 표시 (기존 유지)
  if (!config) {
    const filteredOptions = Object.fromEntries(
      Object.entries(options).filter(([key]) => !excludeFields.includes(key))
    );
    if (Object.keys(filteredOptions).length === 0) return null;

    // CollapsibleSection에서 사용되므로 외부 래퍼 없이 내용만 반환
    return (
      <pre className="text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
        {JSON.stringify(filteredOptions, null, 2)}
      </pre>
    );
  }

  // 렌더링할 행 데이터 준비
  const displayRows = config.rows.map((row) =>
    row.map((field) => ({
      ...field,
      value: options[field.key],
      isEmpty: isEmpty(options[field.key]),
    }))
  );

  // 모든 필드가 undefined면 표시 안 함
  const hasAnyValue = displayRows.flat().some((item) => item.value !== undefined);
  if (!hasAnyValue) return null;

  // CollapsibleSection에서 사용되므로 외부 래퍼 없이 내용만 반환
  return (
    <div className="space-y-3">
      {displayRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {row.map((item) => (
            <div key={item.key} className="flex-1 min-w-0">
              <OptionFieldItem
                label={item.label}
                value={item.value}
                type={item.type}
                isEmpty={item.isEmpty}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Calculate node duration from started_at and finished_at
const getNodeDuration = (node: WorkflowNodeRun): string | null => {
  if (!node.started_at || !node.finished_at) return null;
  const start = new Date(node.started_at).getTime();
  const end = new Date(node.finished_at).getTime();
  const durationMs = end - start;
  if (durationMs < 0) return null;
  return (durationMs / 1000).toFixed(2);
};


export const LogDetail = ({
  run,
  onCompareClick,
  compactMode = false,
}: LogDetailProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const selectedNode =
    run.node_runs?.find((n) => n.node_id === selectedNodeId) ||
    run.node_runs?.[0];

  // 선택된 노드가 변경될 때 해당 버튼으로 스크롤
  useEffect(() => {
    const currentNodeId = selectedNode?.node_id;
    if (currentNodeId) {
      const element = nodeRefs.current.get(currentNodeId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedNode?.node_id]);

  // Calculate actual total tokens and cost from node runs
  const { totalTokens, totalCost } = (run.node_runs || []).reduce(
    (acc, node) => {
      const usage = (node.outputs as any)?.usage;
      if (usage) {
        acc.totalTokens += usage.total_tokens || 0;
        if (typeof (node.outputs as any)?.cost === 'number') {
          acc.totalCost += (node.outputs as any).cost;
        }
      }
      return acc;
    },
    { totalTokens: 0, totalCost: 0 },
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto p-1">
      {/* 1. 헤더: 실행 요약 및 컨트롤 */}
      <div className="border-b border-gray-100 pb-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">실행 상세</h2>
            {run.status === 'success' ? (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> SUCCESS
              </span>
            ) : run.status === 'failed' ? (
              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> FAILED
              </span>
            ) : (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                <PlayCircle className="w-3 h-3" /> RUNNING
              </span>
            )}
          </div>

          {onCompareClick && (
            <button
              onClick={onCompareClick}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm shadow-sm transition-colors"
            >
              <span>⚡ A/B Compare</span>
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div>
            <span className="block text-gray-500 text-xs mb-1">시작 시간</span>
            <span className="font-medium flex items-center gap-1 text-gray-800">
              <Clock className="w-3 h-3" />
              {format(new Date(run.started_at), 'yyyy-MM-dd HH:mm:ss', {
                locale: ko,
              })}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs mb-1">소요 시간</span>
            <span className="font-medium text-gray-800">
              {run.duration ? `${run.duration.toFixed(2)}초` : '-'}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs mb-1">총 토큰</span>
            <span className="font-medium text-gray-800">
              {totalTokens.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="block text-gray-500 text-xs mb-1">총 비용</span>
            <span className="font-medium text-gray-800 flex items-center gap-1">
              <span className="text-amber-600">
                {totalCost > 0 ? `$${totalCost.toFixed(4)}` : '-'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Token Analysis Sections */}
      <LogTokenAnalysis run={run} />

      {/* 3. Visual Execution Path */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-blue-500" />
          실행 흐름
        </h3>
        <LogExecutionPath
          nodeRuns={run.node_runs || []}
          onNodeSelect={setSelectedNodeId}
          selectedNodeId={selectedNode?.node_id ?? null}
        />
      </div>

      {/* 3. 상세 내용 (좌우 분할) */}
      <div className="flex gap-6 items-start">
        <div className="w-1/3 border-r border-gray-100 pr-6 sticky top-0 self-start max-h-[calc(100vh-200px)] overflow-y-auto">
          <h3 className="font-bold text-gray-800 mb-4 sticky top-0 bg-white py-2 z-10">
            노드 실행 경로
          </h3>
          <div className="space-y-3">
            {run.node_runs?.map((node, idx) => {
              const displayInfo = getNodeDisplayInfo(node.node_type);
              const duration = getNodeDuration(node);

              return (
                <button
                  key={`${node.node_id}-${idx}`}
                  ref={(el) => {
                    if (el) {
                      nodeRefs.current.set(node.node_id, el);
                    } else {
                      nodeRefs.current.delete(node.node_id);
                    }
                  }}
                  onClick={() => setSelectedNodeId(node.node_id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedNode?.node_id === node.node_id
                      ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-100'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex ${compactMode ? 'flex-col items-start gap-1' : 'justify-between items-center'} mb-1`}
                  >
                    <span
                      className={`font-semibold text-sm flex items-center gap-2 px-2 py-1 rounded ${displayInfo.color}`}
                    >
                      {displayInfo.icon}
                      {displayInfo.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                        node.status === 'success'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {node.status === 'success' ? '성공' : '실패'}
                    </span>
                  </div>
                  {duration && (
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      소요: {duration}초
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 pl-2">
          <h3 className="font-bold text-gray-800 mb-4 sticky top-0 bg-white py-2 z-10">
            노드 상세 정보
          </h3>
          {selectedNode ? (
            <div className="space-y-6">
              {/* 실행 시점 노드 설정 (맨 위) */}
              {selectedNode.process_data?.node_options && (
                <NodeOptionsSection
                  nodeType={selectedNode.node_type}
                  options={selectedNode.process_data.node_options}
                />
              )}

              {/* 입력 데이터 */}
              <InputDataSection data={selectedNode.inputs} />

              {/* 출력 데이터 */}
              <OutputDataSection data={selectedNode.outputs} />

              {selectedNode.error_message && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-bold text-red-700 flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4" /> 에러 발생
                  </h4>
                  <p className="text-sm text-red-600">
                    {selectedNode.error_message}
                  </p>
                </div>
              )}
            </div>


          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <BrainCircuit className="w-12 h-12 mb-3 opacity-20" />
              <p>왼쪽에서 노드를 선택하여 상세 정보를 확인하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
