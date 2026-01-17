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
 * 각 노드의 사이드패널 섹션 순서와 일치하도록 정렬됨
 */
export const nodeDisplayConfigs: Record<string, NodeDisplayConfig> = {
  // ========================
  // LLM Node
  // 패널 순서: 모델 → 대체모델 → 입력변수 → 참고자료 → 프롬프트 → 파라미터
  // ========================
  llmNode: {
    label: 'LLM 설정',
    rows: [
      [
        { key: 'model_id', label: '모델' },
        { key: 'fallback_model_id', label: '대체 모델' },
      ],
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
      [{ key: 'knowledgeBases', label: '참고 자료 그룹', type: 'list' }],
      [{ key: 'system_prompt', label: '시스템 프롬프트', type: 'text' }],
      [{ key: 'user_prompt', label: '사용자 프롬프트', type: 'text' }],
      [{ key: 'assistant_prompt', label: '어시스턴트 프롬프트', type: 'text' }],
      [{ key: 'parameters', label: '파라미터', type: 'json' }],
    ],
  },

  // ========================
  // Code Node
  // 패널 순서: 입력변수 → Python 코드 → 고급 설정(타임아웃)
  // ========================
  codeNode: {
    label: '코드 설정',
    rows: [
      [{ key: 'inputs', label: '입력변수', type: 'input-mapping-table' }],
      [{ key: 'code', label: 'Python 코드', type: 'code' }],
      [{ key: 'timeout', label: '타임아웃 (초)' }],
    ],
  },

  // ========================
  // HTTP Request Node
  // 패널 순서: 메서드/URL → 입력변수 → 인증 → 헤더 → 본문 → 설정
  // ========================
  httpRequestNode: {
    label: 'HTTP 요청 설정',
    rows: [
      [
        { key: 'method', label: '메서드' },
        { key: 'url', label: 'URL' },
      ],
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
      [
        { key: 'authType', label: '인증 타입' },
        { key: 'authConfig', label: '인증 설정', type: 'json' },
      ],
      [{ key: 'headers', label: '헤더', type: 'json' }],
      [{ key: 'body', label: '바디', type: 'text' }],
      [{ key: 'timeout', label: '타임아웃 (ms)' }],
    ],
  },

  // ========================
  // Condition Node
  // 패널 순서: 분기 조건
  // ========================
  conditionNode: {
    label: '조건 설정',
    rows: [
      [{ key: 'cases', label: '조건 케이스', type: 'json' }],
    ],
  },

  // ========================
  // Template Node
  // 패널 순서: 입력변수 → 템플릿
  // ========================
  templateNode: {
    label: '템플릿 설정',
    rows: [
      [{ key: 'variables', label: '입력변수', type: 'input-mapping-table' }],
      [{ key: 'template', label: '템플릿', type: 'text' }],
    ],
  },

  // ========================
  // Start Node
  // 패널 순서: 입력변수
  // ========================
  startNode: {
    label: '시작 노드 설정',
    rows: [
      [{ key: 'variables', label: '입력 변수', type: 'variables-table' }],
    ],
  },

  // ========================
  // Answer Node
  // 패널 순서: 출력 변수
  // ========================
  answerNode: {
    label: 'Answer 노드 설정',
    rows: [
      [{ key: 'outputs', label: '출력 변수', type: 'input-mapping-table' }],
    ],
  },

  // ========================
  // Webhook Trigger Node
  // 패널 순서: 웹훅 테스트 → 입력 변수
  // ========================
  webhookTriggerNode: {
    label: 'Webhook 트리거 설정',
    rows: [
      [{ key: 'variable_mappings', label: '변수 매핑', type: 'input-mapping-table' }],
    ],
  },

  // ========================
  // Mail Node
  // 패널 순서: 서버 설정 → 계정 → 입력변수 → 검색 옵션
  // ========================
  mailNode: {
    label: 'Mail 노드 설정',
    rows: [
      [
        { key: 'provider', label: '메일 서비스' },
        { key: 'imap_server', label: 'IMAP 서버' },
      ],
      [
        { key: 'imap_port', label: '포트' },
        { key: 'use_ssl', label: 'SSL 사용' },
      ],
      [{ key: 'email', label: '이메일' }],
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
      [
        { key: 'keyword', label: '검색 키워드' },
        { key: 'sender', label: '발신자' },
      ],
      [{ key: 'subject', label: '제목' }],
      [
        { key: 'folder', label: '폴더' },
        { key: 'max_results', label: '최대 결과' },
      ],
      [
        { key: 'unread_only', label: '읽지 않은 메일만' },
        { key: 'mark_as_read', label: '읽음 표시' },
      ],
    ],
  },

  // ========================
  // Workflow Node
  // 패널 순서: Input Parameters
  // ========================
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

  // ========================
  // File Extraction Node
  // 패널 순서: 입력 변수
  // ========================
  fileExtractionNode: {
    label: 'File Extraction 노드 설정',
    rows: [
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
    ],
  },

  // ========================
  // GitHub Node
  // 패널 순서: 작업 → 인증 → 입력변수 → 저장소 정보 → 코멘트
  // ========================
  githubNode: {
    label: 'GitHub 노드 설정',
    rows: [
      [{ key: 'action', label: '작업' }],
      [{ key: 'api_token', label: 'GitHub 토큰' }],
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
      [
        { key: 'repo_owner', label: '소유자' },
        { key: 'repo_name', label: '저장소' },
      ],
      [{ key: 'pr_number', label: 'PR 번호' }],
      [{ key: 'comment_body', label: '코멘트 내용', type: 'text' }],
    ],
  },

  // ========================
  // Schedule Trigger Node
  // 패널 순서: 스케줄 설정 → 타임존
  // ========================
  scheduleTriggerNode: {
    label: 'Schedule 트리거 설정',
    rows: [
      [{ key: 'cron_expression', label: 'Cron 표현식' }],
      [{ key: 'timezone', label: '타임존' }],
    ],
  },

  // ========================
  // Loop Node
  // 패널 순서: 설정 (입력변수, 출력변수, 오류 전략)
  // ========================
  loopNode: {
    label: 'Loop 노드 설정',
    rows: [
      [{ key: 'inputs', label: '입력변수', type: 'input-mapping-table' }],
      [{ key: 'outputs', label: '출력변수', type: 'input-mapping-table' }],
      [{ key: 'error_strategy', label: '오류 응답 방법' }],
    ],
  },

  // ========================
  // Slack Post Node (신규)
  // 패널 순서: 전송 방식 → URL → 인증 → 채널 → 헤더/타임아웃 → 입력변수 → 메시지 → 블록
  // ========================
  slackPostNode: {
    label: 'Slack 메시지 전송 설정',
    rows: [
      [{ key: 'slackMode', label: '전송 방식' }],
      [{ key: 'url', label: 'URL' }],
      [{ key: 'authConfig', label: '인증', type: 'json' }],
      [{ key: 'channel', label: '채널' }],
      [{ key: 'referenced_variables', label: '입력변수', type: 'input-mapping-table' }],
      [{ key: 'message', label: '메시지', type: 'text' }],
      [{ key: 'blocks', label: '블록 (JSON)', type: 'json' }],
      [{ key: 'timeout', label: '타임아웃 (ms)' }],
    ],
  },

  // ========================
  // Variable Extraction Node (변수 추출)
  // 패널 순서: 입력 데이터 → 데이터 필터 설정 (매핑)
  // ========================
  variableExtractionNode: {
    label: '변수 추출 설정',
    rows: [
      [{ key: 'source_selector', label: '입력 데이터 소스', type: 'list' }],
      [{ key: 'mappings', label: '데이터 필터 매핑', type: 'input-mapping-table' }],
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
