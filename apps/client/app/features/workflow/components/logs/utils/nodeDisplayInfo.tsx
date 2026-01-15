import React from 'react';
import {
  Play,
  MessageSquare,
  Sparkles,
  GitFork,
  Code,
  Globe,
  Webhook,
  Calendar,
  Database,
  Slack,
  Mail,
  FileText,
  Bot,
  BrainCircuit,
} from 'lucide-react';

export interface NodeDisplayInfo {
  label: string;
  icon: React.ReactNode;
  color: string;
}

const nodeDisplayMapping: Record<string, NodeDisplayInfo> = {
  startNode: {
    label: '시작',
    icon: <Play className="w-4 h-4" />,
    color: 'text-green-600 bg-green-50',
  },
  answerNode: {
    label: '응답',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-50',
  },
  llmNode: {
    label: 'LLM',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-purple-600 bg-purple-50',
  },
  conditionNode: {
    label: '조건',
    icon: <GitFork className="w-4 h-4" />,
    color: 'text-amber-600 bg-amber-50',
  },
  codeNode: {
    label: '코드',
    icon: <Code className="w-4 h-4" />,
    color: 'text-gray-600 bg-gray-50',
  },
  httpRequestNode: {
    label: 'HTTP 요청',
    icon: <Globe className="w-4 h-4" />,
    color: 'text-cyan-600 bg-cyan-50',
  },
  webhookTriggerNode: {
    label: '웹훅 트리거',
    icon: <Webhook className="w-4 h-4" />,
    color: 'text-indigo-600 bg-indigo-50',
  },
  scheduleTriggerNode: {
    label: '스케줄 트리거',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-orange-600 bg-orange-50',
  },
  knowledgeNode: {
    label: '지식 검색',
    icon: <Database className="w-4 h-4" />,
    color: 'text-emerald-600 bg-emerald-50',
  },
  slackPostNode: {
    label: 'Slack 전송',
    icon: <Slack className="w-4 h-4" />,
    color: 'text-pink-600 bg-pink-50',
  },
  emailNode: {
    label: '이메일',
    icon: <Mail className="w-4 h-4" />,
    color: 'text-red-600 bg-red-50',
  },
  workflowNode: {
    label: '워크플로우 호출',
    icon: <Bot className="w-4 h-4" />,
    color: 'text-violet-600 bg-violet-50',
  },
  templateNode: {
    label: '템플릿',
    icon: <FileText className="w-4 h-4" />,
    color: 'text-teal-600 bg-teal-50',
  },
};

const defaultNodeDisplay: NodeDisplayInfo = {
  label: 'Unknown',
  icon: <BrainCircuit className="w-4 h-4" />,
  color: 'text-gray-600 bg-gray-50',
};

/**
 * 노드 타입에 따른 표시 정보(라벨, 아이콘, 색상)를 반환합니다.
 */
export function getNodeDisplayInfo(nodeType: string): NodeDisplayInfo {
  return nodeDisplayMapping[nodeType] || {
    ...defaultNodeDisplay,
    label: nodeType,
  };
}
