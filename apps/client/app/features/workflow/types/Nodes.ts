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
  system_prompt?: string;
  user_prompt?: string;
  assistant_prompt?: string;
  referenced_variables: LLMVariable[];
  context_variable?: string;
  parameters: Record<string, unknown>;
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

export interface WorkflowNodeData extends BaseNodeData {
  workflowId: string;
  appId: string;
  icon?: string;
  inputs?: WorkflowNodeInput[];
  outputs?: string[]; // 대상 워크플로우의 AnswerNode 출력 변수명 목록
}
// ============================================================================

// ===================== [KnowledgeNode] =====================================
export interface KnowledgeNodeData extends BaseNodeData {
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  queryVariable?: [string, string]; // [node_id, variable_key]
  topK?: number;
}
// ============================================================================

// ==================== [FileExtractionNode] ==================================
export interface FileExtractionNodeData extends BaseNodeData {
  file_path_variable?: [string, string]; // value_selector: [node_id, variable_key]
}
// ============================================================================

// 3. 노드 타입 정의 (ReactFlow Node 제네릭 사용)
export type StartNode = ReactFlowNode<StartNodeData, 'startNode'>;
export type AnswerNode = ReactFlowNode<AnswerNodeData, 'answerNode'>;
export type HttpRequestNode = ReactFlowNode<
  HttpRequestNodeData,
  'httpRequestNode'
>;
export type NoteNode = ReactFlowNode<NoteNodeData, 'note'>;
export type LLMNode = ReactFlowNode<LLMNodeData, 'llmNode'>;
export type ConditionNode = ReactFlowNode<ConditionNodeData, 'conditionNode'>;
export type CodeNode = ReactFlowNode<CodeNodeData, 'codeNode'>;
export type TemplateNode = ReactFlowNode<TemplateNodeData, 'templateNode'>;
export type WorkflowNode = ReactFlowNode<WorkflowNodeData, 'workflowNode'>;
export type KnowledgeNode = ReactFlowNode<KnowledgeNodeData, 'knowledgeNode'>;
export type FileExtractionNode = ReactFlowNode<
  FileExtractionNodeData,
  'fileExtractionNode'
>;

// 4. 전체 노드 유니온 (AppNode)
// 이 타입을 메인 워크플로우에서 사용합니다.
export type AppNode =
  | StartNode
  | AnswerNode
  | HttpRequestNode
  | LLMNode
  | ConditionNode
  | CodeNode
  | TemplateNode
  | FileExtractionNode
  | NoteNode
  | KnowledgeNode
  | WorkflowNode;

//하위 호환성 (필요시)
export type NodeData = BaseNodeData;
export type Node = AppNode;
