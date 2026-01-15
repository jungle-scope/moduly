/**
 * 노드 설정 필드 구성 타입
 */
export type FieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'code' | 'list' | 'json' | 'variables-table' | 'input-mapping-table';
};

export type NodeDisplayConfig = {
  label: string;
  rows: FieldConfig[][];
};

/**
 * 제외할 공통 필드
 */
export const excludeFields = ['title', 'description', 'status'];

/**
 * 노드 타입별 표시할 필드 구성 (행 단위로 그룹화)
 */
export const nodeDisplayConfigs: Record<string, NodeDisplayConfig> = {
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
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
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
        { key: 'inputs', label: '입력 변수 매핑', type: 'input-mapping-table' },
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
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
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
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
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
      [{ key: 'variable_mappings', label: '변수 매핑', type: 'input-mapping-table' }],
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
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
    ],
  },
  workflowNode: {
    label: 'Workflow 노드 설정',
    rows: [
      [
        { key: 'workflowId', label: '워크플로우 ID' },
        { key: 'appId', label: '앱 ID' },
      ],
      [{ key: 'inputs', label: '입력 매핑', type: 'input-mapping-table' }],
    ],
  },
  fileExtractionNode: {
    label: 'File Extraction 노드 설정',
    rows: [
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
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
      [{ key: 'referenced_variables', label: '참조 변수', type: 'input-mapping-table' }],
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
        { key: 'inputs', label: '입력 매핑', type: 'input-mapping-table' },
        { key: 'outputs', label: '출력 매핑', type: 'input-mapping-table' },
      ],
    ],
  },
};

/**
 * 노드 타입에 해당하는 표시 구성을 반환합니다.
 */
export function getDisplayConfig(nodeType: string): NodeDisplayConfig | null {
  return nodeDisplayConfigs[nodeType] || null;
}

/**
 * 값이 비어있는지 확인하는 헬퍼 함수
 */
export function isEmpty(value: any): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}
