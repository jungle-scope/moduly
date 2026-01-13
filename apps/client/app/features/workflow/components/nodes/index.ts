import { StartNode } from './start/components/StartNode';
import { AnswerNode } from './answer/components/AnswerNode';
import { HttpRequestNode } from './http/components/HttpRequestNode';
import { SlackPostNode } from './slack/components/SlackPostNode';
import { CodeNode } from './code/components/CodeNode';
import { ConditionNode } from './condition/components/ConditionNode';
import { LLMNode } from './llm/components/LLMNode';
import { TemplateNode } from './template/components/TemplateNode';
import { WorkflowNode } from './workflow/components/WorkflowNode';
import { FileExtractionNode } from './file_extraction/components/FileExtractionNode';
import { WebhookTriggerNode } from './webhook/components/WebhookTriggerNode';
import { ScheduleTriggerNode } from './schedule/components/ScheduleTriggerNode';

import { GithubNode } from './github/components/GithubNode';
import { MailNode } from './mail/components/MailNode';
import { LoopNode } from './loop/components/LoopNode';

// NOTE: ReactFlow에 등록할 노드 타입 맵
export const nodeTypes = {
  startNode: StartNode,
  answerNode: AnswerNode,
  httpRequestNode: HttpRequestNode,
  slackPostNode: SlackPostNode,
  codeNode: CodeNode,
  conditionNode: ConditionNode,
  llmNode: LLMNode,
  templateNode: TemplateNode,
  workflowNode: WorkflowNode,
  fileExtractionNode: FileExtractionNode,
  webhookTrigger: WebhookTriggerNode,
  scheduleTrigger: ScheduleTriggerNode,

  githubNode: GithubNode,
  mailNode: MailNode,
  loopNode: LoopNode,
};
