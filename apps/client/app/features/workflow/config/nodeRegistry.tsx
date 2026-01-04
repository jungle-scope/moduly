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
} from 'lucide-react';
import React, { ReactNode } from 'react';

/**
 * Node Definition Interface
 * 향후 DB에서 가져올 노드 정보의 구조를 정의합니다.
 */
export interface NodeDefinition {
  id: string; // 'start', 'end', 'llm', etc.
  type: string; // React Flow node type: 'startNode', 'endNode', etc.
  name: string; // Display name
  category:
    | 'trigger'
    | 'llm'
    | 'plugin'
    | 'workflow'
    | 'logic'
    | 'database'
    | 'data';
  color: string; // Tailwind class OR Hex color
  icon?: ReactNode | string; // Icon component or Emoji
  implemented: boolean; // 현재 구현 여부
  unique?: boolean; // 워크플로우당 하나만 허용
  description?: string; // 노드 설명
  defaultData: () => any; // 기본 데이터 생성 함수
}

/**
 * Node Registry
 */
export const nodeRegistry: NodeDefinition[] = [
  // Trigger Category
  {
    id: 'start',
    type: 'startNode',
    name: '시작',
    category: 'trigger',
    color: '#3b82f6', // blue-500
    icon: <Play className="w-3.5 h-3.5 text-white fill-current" />,
    implemented: true,
    unique: true, // 워크플로우당 하나만 허용
    description: '워크플로우의 시작점. 입력 변수를 정의합니다.',
    defaultData: (): StartNodeData => ({
      title: '시작',
      triggerType: 'manual' as TriggerType,
      variables: [],
    }),
  },
  {
    id: 'webhook-trigger',
    type: 'webhookTrigger',
    name: 'Webhook Trigger',
    category: 'trigger',
    color: '#a855f7', // purple-500
    icon: <Webhook className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '외부 Webhook으로 워크플로우를 시작합니다.',
    defaultData: () => ({
      title: 'Webhook Trigger',
      provider: 'custom',
      variable_mappings: [],
    }),
  },

  // LLM Category
  {
    id: 'llm',
    type: 'llmNode',
    name: 'LLM',
    category: 'llm',
    color: '#9333ea', // purple-600
    icon: <Bot className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'LLM 모델을 호출합니다.',
    defaultData: () => ({
      title: 'LLM',
      provider: '',
      model_id: '',
      system_prompt: '',
      user_prompt: '',
      assistant_prompt: '',
      referenced_variables: [],
      context_variable: '',
      parameters: {},
    }),
  },

  // Plugin Category
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

  // Workflow Category
  {
    id: 'workflow',
    type: 'workflowNode',
    name: '워크플로우',
    category: 'workflow',
    color: '#14b8a6', // teal-500
    icon: <Puzzle className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '다른 워크플로우(App)를 모듈로 실행합니다.',
    defaultData: () => ({
      title: '워크플로우 모듈',
      workflowId: '',
      appId: '',
      inputs: [],
      outputs: [],
    }),
  },

  // Logic Category
  {
    id: 'code',
    type: 'codeNode',
    name: '코드 실행',
    category: 'logic',
    color: '#3b82f6', // blue-500
    icon: <Code className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'Python 코드를 Docker 샌드박스에서 안전하게 실행합니다',
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
    name: '분기',
    category: 'logic',
    color: '#f97316', // orange-500
    icon: <GitFork className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '조건에 따라 분기합니다.',
    defaultData: () => ({
      title: '분기',
      conditions: [],
    }),
  },
  {
    id: 'knowledge',
    type: 'knowledgeNode',
    name: '지식',
    category: 'data',
    color: '#6366f1', // indigo-500
    icon: <BookOpen className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '지식 베이스를 조회하고 검색합니다.',
    defaultData: () => ({
      title: '지식',
      description: '지식 베이스 검색',
      knowledgeBases: [],
      queryVariable: undefined,
      scoreThreshold: 0.5,
      topK: 3,
      queryVariables: [],
      userQuery: '',
    }),
  },
  {
    id: 'file-extraction',
    type: 'fileExtractionNode',
    name: 'PDF 텍스트 추출',
    category: 'logic',
    color: '#4f46e5', // indigo-600
    icon: <FileText className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: 'PDF 파일에서 텍스트를 추출합니다.',
    defaultData: () => ({
      title: 'PDF 텍스트 추출',
      file_path_variable: undefined,
    }),
  },
  {
    id: 'answer',
    type: 'answerNode',
    name: '응답',
    category: 'logic',
    color: '#10b981', // green-500
    icon: <MessageSquare className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '워크플로우의 최종 결과를 수집합니다.',
    defaultData: () => ({
      title: '응답',
      outputs: [],
    }),
  },
  {
    id: 'http',
    type: 'httpRequestNode',
    name: 'HTTP 요청',
    category: 'plugin',
    color: '#0ea5e9', // sky-500
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
    id: 'template',
    type: 'templateNode',
    name: '템플릿',
    category: 'logic',
    color: '#db2777', // pink-600
    icon: <LayoutTemplate className="w-3.5 h-3.5 text-white" />,
    implemented: true,
    description: '여러 변수를 조합하여 텍스트를 생성합니다.',
    defaultData: () => ({
      title: '템플릿',
      template: '',
      variables: [],
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
