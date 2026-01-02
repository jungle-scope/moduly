import { StartNode } from './start/components/StartNode';
import { AnswerNode } from './answer/components/AnswerNode';
import { HttpRequestNode } from './http/components/HttpRequestNode';
import { CodeNode } from './code/components/CodeNode';
import { ConditionNode } from './condition/components/ConditionNode';
import { LLMNode } from './llm/components/LLMNode';
import { TemplateNode } from './template/components/TemplateNode';
import { WorkflowNode } from './workflow/components/WorkflowNode';
// import EndNode from './EndNode';

// NOTE: ReactFlow에 등록할 노드 타입 맵
export const nodeTypes = {
  startNode: StartNode,
  answerNode: AnswerNode,
  httpRequestNode: HttpRequestNode,
  codeNode: CodeNode,
  conditionNode: ConditionNode,
  llmNode: LLMNode,
  templateNode: TemplateNode,
  workflowNode: WorkflowNode,
  // endNode: EndNode,
};
