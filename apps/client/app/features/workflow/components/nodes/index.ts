import { StartNode } from './start/components/StartNode';
import { AnswerNode } from './answer/components/AnswerNode';
import { ConditionNode } from './condition/components/ConditionNode';
import { LLMNode } from './llm/components/LLMNode';
// import EndNode from './EndNode';

// NOTE: ReactFlow에 등록할 노드 타입 맵
export const nodeTypes = {
  startNode: StartNode,
  answerNode: AnswerNode,
  conditionNode: ConditionNode,
  llmNode: LLMNode,
  // endNode: EndNode,
};
