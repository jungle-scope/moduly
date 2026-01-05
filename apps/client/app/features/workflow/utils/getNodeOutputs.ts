// 노드들의 출력 값을 정의합니다. 기본으로 정해진 값들이 있고, 동적으로 생성되는 경우가 존재합니다.

import { Node } from '../types/Workflow';

export const getNodeOutputs = (node: Node): string[] => {
  if (!node) return [];

  switch (node.type) {
    case 'startNode':
      return (node.data?.variables as any[])?.map((v) => v.name) || [];
    case 'webhookTrigger':
      return (
        (node.data?.variable_mappings as any[])?.map((v) => v.variable_name) ||
        []
      );
    case 'llmNode':
      return ['text', 'usage', 'model'];
    case 'templateNode':
      return ['text'];
    case 'codeNode':
      return ['result'];
    case 'httpRequestNode':
      return ['status', 'data', 'headers'];
    case 'answerNode':
      return [];
    case 'workflowNode':
      return ['result'];
    case 'fileExtractionNode':
      return ['result', 'page_count'];
    case 'knowledgeNode':
      return ['context', 'metadata'];
    default:
      return ['result'];
  }
};
