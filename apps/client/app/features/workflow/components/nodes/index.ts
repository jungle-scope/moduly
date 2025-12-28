import { StartNode } from './start/components/StartNode';
import { AnswerNode } from './answer/components/AnswerNode';
import { HttpRequestNode } from './http/components/HttpRequestNode';
// import EndNode from './EndNode';

export const nodeTypes = {
  startNode: StartNode,
  answerNode: AnswerNode,
  httpRequestNode: HttpRequestNode,
  // endNode: EndNode,
};
