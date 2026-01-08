import { Node as ReactFlowNode } from '@xyflow/react';

// 모든 노드가 가져야 할 공통 데이터 필드. 서버의 BaseNodeData에 대응됩니다.
export interface BaseNodeData {
  title: string;
  description?: string;
  // UI 표시용 상태 필드 (실행 중 시각적 피드백)
  selected?: boolean; // 노드 선택 여부
  status?: 'idle' | 'running' | 'success' | 'failure'; // 실행 상태 (UI용)
  [key: string]: unknown;
}

// ========================== [Start Node] ====================================
// 입력 변수의 데이터 타입을 정의
export type VariableType =
  | 'text' // 단답형 텍스트
  | 'number' // 숫자
  | 'paragraph' // 장문 텍스트
  | 'checkbox' // 체크박스
  | 'select' // 선택
  | 'file'; // 파일 업로드 (PDF)

export type TriggerType = 'manual' | 'webhook' | 'cron';
export interface SelectOption {
  label: string;
  value: string;
}

// 워크플로우 전체의 시작 입력값 정의
export interface WorkflowVariable {
  id: string;
  name: string; // 변수명 (코드용)
  label: string; // 표시명 (사용자 표시용)
  type: VariableType;
  required?: boolean;

  // 타입별 추가 설정
  maxLength?: number;
  placeholder?: string;
  options?: SelectOption[];
  maxFileSize?: number; // 파일 최대 크기 (bytes, PDF용)
}

export interface StartNodeData extends BaseNodeData {
  triggerType: TriggerType;
  variables?: WorkflowVariable[];
}
// ============================================================================

// ========================= [Answer Node] ====================================
export interface AnswerNodeOutput {
  variable: string;
  value_selector: string[]; // [node_id, key]
}

export interface AnswerNodeData extends BaseNodeData {
  outputs: AnswerNodeOutput[];
}
// ============================================================================

// ======================== [HTTP Request Node] ===============================
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type AuthType = 'none' | 'bearer' | 'apiKey';

export interface HttpVariable {
  name: string;
  value_selector: string[];
}

export interface HttpRequestNodeData extends BaseNodeData {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  timeout: number;
  authType: AuthType;
  authConfig: {
    token?: string; // Bearer token
    apiKeyHeader?: string; // API Key header name
    apiKeyValue?: string; // API Key value
  };
  referenced_variables: HttpVariable[];
}
// ============================================================================

// ======================== [Slack Post Node] ================================
export interface SlackPostNodeData extends HttpRequestNodeData {
  slackMode?: 'webhook' | 'api';
  channel?: string;
  message?: string;
  username?: string;
  thread_ts?: string;
  icon_emoji?: string;
  blocks?: string;
  attachments?: string;
}
// ============================================================================

// ======================== [Condition Node] ==================================
// [NoteNode]
export interface NoteNodeData extends BaseNodeData {
  content: string;
}

export interface Condition {
  id: string; // uuid
  variable_selector: string[]; // [node_id, key]
  operator: string;
  value: string;
}

export interface ConditionCase {
  id: string; // case ID (핸들 ID로 사용)
  case_name: string; // 사용자가 지정하는 분기 이름
  conditions: Condition[];
  logical_operator: 'and' | 'or';
}

export interface ConditionNodeData extends BaseNodeData {
  cases: ConditionCase[];
}
// ============================================================================

// ======================== [LLMNode] =========================================
export interface LLMVariable {
  name: string;
  value_selector: string[];
}

export interface LLMNodeData extends BaseNodeData {
  provider: string;
  model_id: string;
  fallback_model_id?: string;
  system_prompt?: string;
  user_prompt?: string;
  assistant_prompt?: string;
  referenced_variables: LLMVariable[];
  context_variable?: string;
  parameters: Record<string, unknown>;

  // 참고 자료 (Knowledge) 통합 필드
  knowledgeBases?: { id: string; name: string }[];
  scoreThreshold?: number;
  topK?: number;
}
// ============================================================================

// [TemplateNode]
export interface TemplateVariable {
  name: string;
  value_selector: string[]; // [node_id, variable_key]
}

export interface TemplateNodeData extends BaseNodeData {
  template: string;
  variables: TemplateVariable[];
}

// ======================== [CodeNode] ========================================
export interface CodeNodeInput {
  name: string; // 코드 내에서 사용할 변수 이름
  source: string; // 소스 경로 (예: "Start.query")
}

export interface CodeNodeData extends BaseNodeData {
  code: string; // 실행할 Python 코드
  inputs: CodeNodeInput[]; // 입력 변수 매핑
  timeout: number; // 타임아웃 (초)
}
// ============================================================================

// ======================== [WorkflowNode] ====================================
export interface WorkflowNodeInput {
  name: string; // 대상 변수 이름
  value_selector: string[]; // [node_id, key]
}

// 다른 곳에 정의되지 않은 경우 InputSchema 및 OutputSchema를 위한 자리 표시자
export interface InputSchema {
  [key: string]: any;
}
export interface OutputSchema {
  [key: string]: any;
}

export interface WorkflowNodeData extends NodeData {
  appId: string;
  name: string;
  description?: string;
  version: number;
  input_schema?: InputSchema;
  output_schema?: OutputSchema;
  icon?: string;
  inputs?: WorkflowNodeInput[]; // 대상 워크플로우의 StartNode 입력 변수 매핑
  outputs?: string[]; // 대상 워크플로우의 AnswerNode 출력 변수명 목록

  // 확장 데이터
  deployment_id?: string;
  graph_snapshot?: Record<string, any>; // 확장된 내부 그래프
  expanded?: boolean;
}
// ============================================================================

// ==================== [WebhookTriggerNode] ==================================
export interface VariableMapping {
  variable_name: string;
  json_path: string;
}

export interface WebhookTriggerNodeData extends BaseNodeData {
  provider: 'jira' | 'custom';
  variable_mappings: VariableMapping[];
}
// ============================================================================

// ==================== [ScheduleTriggerNode] =================================
export interface ScheduleTriggerNodeData extends BaseNodeData {
  cron_expression: string; // Cron 표현식 (예: "0 9 * * *")
  timezone: string; // 타임존 (예: "Asia/Seoul", "UTC")
}
// ============================================================================

// ==================== [FileExtractionNode] ==================================
export interface FileExtractionNodeData extends BaseNodeData {
  file_path_variable?: [string, string]; // value_selector: [node_id, variable_key]
}
// ============================================================================

// ======================== [GithubNode] ======================================
export type GithubAction = 'get_pr' | 'comment_pr';

export interface GithubVariable {
  name: string;
  value_selector: string[]; // [node_id, output_key]
}

export interface GithubNodeData extends BaseNodeData {
  action: GithubAction;
  api_token: string;
  repo_owner: string;
  repo_name: string;
  pr_number: number;
  comment_body?: string;
  referenced_variables: GithubVariable[];
}
// ============================================================================

// ========================= [Mail Node] ======================================
export type EmailProvider = 'gmail' | 'naver' | 'daum' | 'outlook' | 'custom';

export interface MailVariable {
  name: string;
  value_selector: string[];
}

export interface MailNodeData extends BaseNodeData {
  // Account
  email: string;
  password: string;

  // Server
  provider: EmailProvider;
  imap_server: string;
  imap_port: number;
  use_ssl: boolean;

  // 검색 설정
  keyword?: string;
  sender?: string;
  subject?: string;
  start_date?: string;
  end_date?: string;

  // Options
  folder: string;
  max_results?: number; // Optional: 기본값 10
  unread_only: boolean;
  mark_as_read: boolean;

  // Variables
  referenced_variables: MailVariable[];
}

// 3. 노드 타입 정의 (ReactFlow Node 제네릭 사용)
export type StartNode = ReactFlowNode<StartNodeData, 'startNode'>;
export type AnswerNode = ReactFlowNode<AnswerNodeData, 'answerNode'>;
export type HttpRequestNode = ReactFlowNode<
  HttpRequestNodeData,
  'httpRequestNode'
>;
export type SlackPostNode = ReactFlowNode<
  SlackPostNodeData,
  'slackPostNode'
>;
export type NoteNode = ReactFlowNode<NoteNodeData, 'note'>;
export type LLMNode = ReactFlowNode<LLMNodeData, 'llmNode'>;
export type ConditionNode = ReactFlowNode<ConditionNodeData, 'conditionNode'>;
export type CodeNode = ReactFlowNode<CodeNodeData, 'codeNode'>;
export type TemplateNode = ReactFlowNode<TemplateNodeData, 'templateNode'>;
export type WorkflowNode = ReactFlowNode<WorkflowNodeData, 'workflowNode'>;

export type FileExtractionNode = ReactFlowNode<
  FileExtractionNodeData,
  'fileExtractionNode'
>;
export type WebhookTriggerNode = ReactFlowNode<
  WebhookTriggerNodeData,
  'webhookTrigger'
>;
export type ScheduleTriggerNode = ReactFlowNode<
  ScheduleTriggerNodeData,
  'scheduleTrigger'
>;
export type GithubNode = ReactFlowNode<GithubNodeData, 'githubNode'>;

export type MailNode = ReactFlowNode<MailNodeData, 'mailNode'>;
// ============================================================================

// 4. 전체 노드 유니온 (AppNode)
// 이 타입을 메인 워크플로우에서 사용합니다.
export type AppNode =
  | StartNode
  | AnswerNode
  | HttpRequestNode
  | SlackPostNode
  | LLMNode
  | ConditionNode
  | CodeNode
  | TemplateNode
  | FileExtractionNode
  | WebhookTriggerNode
  | ScheduleTriggerNode
  | GithubNode
  | MailNode
  | NoteNode
  | WorkflowNode;

// 하위 호환성 (필요시)
export type NodeData = BaseNodeData;
export type Node = AppNode;
