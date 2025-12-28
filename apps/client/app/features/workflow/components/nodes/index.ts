import { StartNode } from './start/components/StartNode';
import { AnswerNode } from './answer/components/AnswerNode';
// import EndNode from './EndNode';

export const nodeTypes = {
  start: StartNode,
  // startNode: StartNode, // Legacy support if needed
  answerNode: AnswerNode,
  // endNode: EndNode,
};
