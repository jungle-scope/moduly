import { StartNodeData, TriggerType } from '../types/Nodes';
import {
  Play,
  Bot,
  Puzzle,
  Code,
  GitFork,
  FileText,
  MessageSquare,
  Globe,
  LayoutTemplate,
  Plug,
  BookOpen,
  Webhook,
  Github,
  Mail,
  Clock,
  Slack,
  Repeat,
} from 'lucide-react';
import React, { ReactNode } from 'react';

/**
 * Node Definition Interface
 * 향후 DB에서 가져올 노드 정보의 구조를 정의합니다.
 */
export interface NodeDefinition {
  id: string; // 'start', 'end', 'llm' 등
  type: string; // React Flow 노드 타입: 'startNode', 'endNode' 등
  name: string; // 표시 이름
  category:
    | 'trigger'
    | 'llm'
    | 'plugin'
    | 'workflow'
    | 'logic'
    | 'database'
    | 'data';
  color: string; // Tailwind 클래스 또는 Hex 색상
  icon?: ReactNode | string; // 아이콘 컴포넌트 또는 이모지
  implemented: boolean; // 현재 구현 여부
  unique?: boolean; // 워크플로우당 하나만 허용
  description?: string; // 노드 설명
  defaultData: () => any; // 기본 데이터 생성 함수
}

/**
 * Node Registry
 */
export const nodeRegistry: NodeDefinition[] = [
  // 트리거 카테고리
  {
    id: 'start',
    type: 'startNode',
    name: '입력',
    category: 'trigger',
    color: '#3b82f6', // blue-500 색상
    icon: <Play className="w-3.5 h-3.5 text-white fill-current" />,
    implemented: true,
    unique: true, // 워크플로우당 하나만 허용
    description: '모듈의 입력 변수를 정의합니다.',
    defaultData: (): StartNodeData => ({
      title: '입력',
      triggerType: 'manual' as TriggerType,
      variables: [],
    }),
  },
  {
    id: 'webhook-trigger',
    type: 'webhookTrigger',
    name: '웹훅 트리거',
    category: 'trigger',
    color: '#a855f7', // purple-500 색상
    icon: <Webhook className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '외부 Webhook으로 모듈을 시작합니다.',
    defaultData: () => ({
      title: '웹훅 트리거',
      provider: 'custom',
      variable_mappings: [],
    }),
  },
  {
    id: 'schedule-trigger',
    type: 'scheduleTrigger',
    name: '알람 트리거',
    category: 'trigger',
    color: '#8b5cf6', // violet-500 색상
    icon: <Clock className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '지정된 시간에 모듈을 자동으로 시작합니다.',
    defaultData: () => ({
      title: '알람 트리거',
      cron_expression: '0 9 * * *',
      timezone: 'UTC',
    }),
  },

  // LLM 카테고리
  {
    id: 'llm',
    type: 'llmNode',
    name: 'LLM',
    category: 'llm',
    color: '#9333ea', // purple-600 색상
    icon: <Bot className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'LLM 모델을 호출합니다.',
    defaultData: () => ({
      title: 'LLM',
      provider: '',
      model_id: '',
      fallback_model_id: '',
      system_prompt: '',
      user_prompt: '',
      assistant_prompt: '',
      referenced_variables: [],
      context_variable: '',
      parameters: {
        temperature: 0.7,
        top_p: 1.0,
        max_tokens: 4096,
        presence_penalty: 0.0,
        frequency_penalty: 0.0,
        stop: [],
      },
    }),
  },

  // 플러그인 카테고리
  {
    id: 'plugin',
    type: 'pluginNode',
    name: '플러그인',
    category: 'plugin',
    color: '#a855f7', // purple-500
    icon: <Plug className="w-3.5 h-3.5 text-white" />,
    implemented: false,
    description: '외부 플러그인을 실행합니다.',
    defaultData: () => ({
      title: '플러그인',
      pluginId: '',
    }),
  },

  // 서브 모듈 카테고리
  {
    id: 'workflow',
    type: 'workflowNode',
    name: '서브 모듈',
    category: 'workflow',
    color: '#14b8a6', // teal-500 색상
    icon: <Puzzle className="w-5 h-5 text-white" />,
    implemented: true,
    description: '다른 모듈을 노드로 실행합니다.',
    defaultData: () => ({
      title: '서브 모듈',
      workflowId: '',
      appId: '',
      inputs: [],
      outputs: [],
    }),
  },

  // 로직 카테고리
  {
    id: 'code',
    type: 'codeNode',
    name: '코드 실행',
    category: 'logic',
    color: '#3b82f6', // blue-500 색상
    icon: <Code className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'Python 코드를 샌드박스에서 안전하게 실행합니다',
    defaultData: () => ({
      title: '코드 실행',
      code: `def main(inputs):
    # 입력변수를 inputs['변수명']의 형태로 할당
    
    val1 = inputs['변수명1']
    val2 = inputs['변수명2']
    
    total = val1 + val2
    
    # 반드시 딕셔너리 형태로 결과 반환
    return {
        "result": total
    }`,
      inputs: [],
      timeout: 10,
    }),
  },
  {
    id: 'condition',
    type: 'conditionNode',
    name: 'IF/ELSE',
    category: 'logic',
    color: '#f97316', // orange-500 색상
    icon: <GitFork className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '조건에 따라 분기합니다.',
    defaultData: () => ({
      title: 'IF/ELSE',
      conditions: [],
    }),
  },

  {
    id: 'file-extraction',
    type: 'fileExtractionNode',
    name: '문서 추출',
    category: 'logic',
    color: '#4f46e5', // indigo-600 색상
    icon: <FileText className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '문서 파일에서 텍스트를 추출합니다.',
    defaultData: () => ({
      title: '문서 추출',
      referenced_variables: [],
    }),
  },
  {
    id: 'answer',
    type: 'answerNode',
    name: '응답',
    category: 'logic',
    color: '#10b981', // green-500 색상
    icon: <MessageSquare className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '모듈의 최종 결과를 수집합니다.',
    defaultData: () => ({
      title: '응답',
      outputs: [],
    }),
  },
  {
    id: 'loop',
    type: 'loopNode',
    name: '반복',
    category: 'logic',
    color: '#8b5cf6', // violet-500 색상
    icon: <Repeat className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '배열의 각 항목에 대해 작업을 반복 실행합니다.',
    defaultData: () => ({
      title: '반복',
      loop_key: '',
      inputs: [],
      outputs: [],
      max_iterations: 100,
      parallel_mode: false,
      error_strategy: 'end',
      flatten_output: true,
    }),
  },
  {
    id: 'http',
    type: 'httpRequestNode',
    name: 'HTTP 요청',
    category: 'plugin',
    color: '#0ea5e9', // sky-500 색상
    icon: <Globe className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '외부 API로 HTTP 요청을 보냅니다.',
    defaultData: () => ({
      title: 'HTTP 요청',
      method: 'GET',
      url: '',
      headers: [],
      body: '',
      timeout: 5000,
    }),
  },
  {
    id: 'slack-post',
    type: 'slackPostNode',
    name: 'slack',
    category: 'plugin',
    color: '#4A154B', // Slack 공식 색상
    icon: <Slack className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'Slack으로 메시지를 전송합니다.',
    defaultData: () => ({
      title: 'slack',
      method: 'POST',
      url: '',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: JSON.stringify(
        {
          text: '',
        },
        null,
        2,
      ),
      timeout: 5000,
      authType: 'none',
      authConfig: {},
      referenced_variables: [],
      message: '',
      channel: '',
      blocks: '',
      slackMode: 'webhook',
    }),
  },
  {
    id: 'template',
    type: 'templateNode',
    name: '템플릿',
    category: 'logic',
    color: '#db2777', // pink-600 색상
    icon: <LayoutTemplate className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '여러 변수를 조합하여 텍스트를 생성합니다.',
    defaultData: () => ({
      title: '템플릿',
      template: '',
      variables: [],
    }),
  },
  {
    id: 'github',
    type: 'githubNode',
    name: 'github',
    category: 'plugin',
    color: '#333', // GitHub 공식 색상
    icon: <Github className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'GitHub PR과 상호작용합니다 (Diff 조회, 댓글 작성).',
    defaultData: () => ({
      title: 'github',
      action: 'get_pr',
      api_token: '',
      repo_owner: '',
      repo_name: '',
      pr_number: 0,
      comment_body: '',
      referenced_variables: [],
    }),
  },
  {
    id: 'mail',
    type: 'mailNode',
    name: '메일 검색',
    category: 'plugin',
    color: '#EA4335',
    icon: <Mail className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description:
      'IMAP을 통해 이메일을 검색합니다 (Gmail, Naver, Daum, Outlook 등)',
    defaultData: () => ({
      title: '메일 검색',
      email: '',
      password: '',
      provider: 'gmail',
      imap_server: 'imap.gmail.com',
      imap_port: 993,
      use_ssl: true,
      folder: 'INBOX',
      max_results: 10,
      unread_only: false,
      mark_as_read: false,
      referenced_variables: [],
    }),
  },
];

/**
 * 카테고리별 노드 그룹화
 */
export const getNodesByCategory = () => {
  const categories = new Map<string, NodeDefinition[]>();

  nodeRegistry.forEach((node) => {
    const category = node.category;
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(node);
  });

  return categories;
};

/**
 * 구현된 노드만 필터링
 */
export const getImplementedNodes = () => {
  return nodeRegistry.filter((node) => node.implemented);
};

/**
 * 노드 ID로 노드 정의 찾기
 */
export const getNodeDefinition = (id: string): NodeDefinition | undefined => {
  return nodeRegistry.find((node) => node.id === id);
};

/**
 * 노드 타입으로 노드 정의 찾기 (React Flow type)
 */
export const getNodeDefinitionByType = (
  type: string,
): NodeDefinition | undefined => {
  return nodeRegistry.find((node) => node.type === type);
};
