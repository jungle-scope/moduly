import { StartNodeData, TriggerType } from '../types/Nodes';

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
  color: string; // Tailwind class for color
  icon?: string; // Emoji or icon identifier
  implemented: boolean; // 현재 구현 여부
  unique?: boolean; // 워크플로우당 하나만 허용
  description?: string; // 노드 설명
  defaultData: () => any; // 기본 데이터 생성 함수
}

/**
 * Node Registry
 * 현재는 하드코딩되어 있지만, 향후 API를 통해 DB에서 가져올 수 있도록 설계되었습니다.
 *
 * TODO: 이 데이터를 DB에서 가져오는 API로 교체
 * Example: const nodes = await fetchNodesFromDB();
 */
export const nodeRegistry: NodeDefinition[] = [
  // Trigger Category
  {
    id: 'start',
    type: 'startNode',
    name: 'Start',
    category: 'trigger',
    color: 'bg-green-500',
    icon: '▶️',
    implemented: true,
    unique: true, // 워크플로우당 하나만 허용
    description: '워크플로우의 시작점. 입력 변수를 정의합니다.',
    defaultData: (): StartNodeData => ({
      title: 'Start',
      triggerType: 'manual' as TriggerType,
      variables: [],
    }),
  },

  // LLM Category
  {
    id: 'llm',
    type: 'llmNode',
    name: 'LLM',
    category: 'llm',
    color: 'bg-black',
    icon: '🤖',
    implemented: true, // NOTE: [LLM] 프론트에서 LLM 노드를 사용 가능하게 활성화
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
    name: 'Plugin',
    category: 'plugin',
    color: 'bg-purple-500',
    icon: '🔌',
    implemented: false,
    description: '외부 플러그인을 실행합니다.',
    defaultData: () => ({
      title: 'Plugin',
      pluginId: '',
    }),
  },

  // Workflow Category
  {
    id: 'workflow',
    type: 'workflowNode',
    name: 'Workflow',
    category: 'workflow',
    color: 'bg-green-500',
    icon: '🔄',
    implemented: true,
    description: '다른 워크플로우(App)를 모듈로 실행합니다.',
    defaultData: () => ({
      title: 'Workflow Module',
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
    color: '#10B981', // Changed from 'bg-cyan-500' to '#10B981'
    icon: '💻',
    implemented: true,
    description: 'Python 코드를 Docker 샌드박스에서 안전하게 실행합니다', // Updated description
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
    name: 'Condition',
    category: 'logic',
    color: 'bg-blue-500',
    icon: '🔀',
    implemented: true,
    description: '조건에 따라 분기합니다.',
    defaultData: () => ({
      title: 'Condition',
      conditions: [],
    }),
  },
  {
    id: 'answer',
    type: 'answerNode',
    name: 'Answer',
    category: 'logic',
    color: 'bg-orange-500',
    icon: '🏁',
    implemented: true,
    description: '워크플로우의 최종 결과를 수집합니다.',
    defaultData: () => ({
      title: 'Answer',
      outputs: [],
    }),
  },
  {
    id: 'http',
    type: 'httpRequestNode',
    name: 'HTTP Request',
    category: 'plugin',
    color: 'bg-purple-500',
    icon: '🌍',
    implemented: true,
    description: '외부 API로 HTTP 요청을 보냅니다.',
    defaultData: () => ({
      title: 'HTTP Request',
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
    name: 'Template',
    category: 'logic',
    color: 'bg-yellow-500',
    icon: '📝',
    implemented: true,
    description: '여러 변수를 조합하여 텍스트를 생성합니다.',
    defaultData: () => ({
      title: 'Template',
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
