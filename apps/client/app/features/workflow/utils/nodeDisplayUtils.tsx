import {
  Play,
  MessageSquare,
  GitFork,
  Code,
  Globe,
  Webhook,
  Calendar,
  Database,
  Sparkles,
  FileText,
  Bot,
  BrainCircuit,
  Mail,
  BookOpen,
} from 'lucide-react';
import React from 'react';

export interface NodeDisplayInfo {
  label: string;
  icon: React.ReactNode;
  color: string;
}

// Extract node type from various formats:
// - "startNode" -> "start"
// - "start-1234567890" -> "start"  
// - "slackPost (slack-post-123)" -> "slackPost"
// - "llmNode" -> "llm"
const extractNodeType = (nodeIdentifier: string): string => {
  // Remove the "(xxx)" part if exists: "slackPost (slack-post-123)" -> "slackPost"
  const withoutParens = nodeIdentifier.split('(')[0].trim();
  
  // Handle kebab-case IDs: "slack-post-1234" -> "slack-post" -> "slackPost"
  // Extract prefix before the numeric suffix
  const match = withoutParens.match(/^([a-zA-Z-]+)/);
  if (match) {
    const prefix = match[1];
    // Convert kebab-case to camelCase and remove trailing hyphen
    const cleaned = prefix.replace(/-$/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return cleaned.toLowerCase();
  }
  
  // Fallback: just lowercase and remove "Node" suffix
  return withoutParens.replace(/Node$/i, '').toLowerCase();
};

// Node type to Korean label and icon mapping
export const getNodeDisplayInfo = (nodeIdentifier: string): NodeDisplayInfo => {
  const nodeType = extractNodeType(nodeIdentifier);
  
  const mapping: Record<string, NodeDisplayInfo> = {
    start: { label: '시작', icon: <Play className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
    answer: { label: '응답', icon: <MessageSquare className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
    llm: { label: 'LLM', icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50' },
    condition: { label: '조건', icon: <GitFork className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
    code: { label: '코드', icon: <Code className="w-4 h-4" />, color: 'text-gray-600 bg-gray-100' },
    httprequest: { label: 'HTTP', icon: <Globe className="w-4 h-4" />, color: 'text-cyan-600 bg-cyan-50' },
    http: { label: 'HTTP', icon: <Globe className="w-4 h-4" />, color: 'text-cyan-600 bg-cyan-50' },
    webhooktrigger: { label: '웹훅', icon: <Webhook className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
    webhook: { label: '웹훅', icon: <Webhook className="w-4 h-4" />, color: 'text-indigo-600 bg-indigo-50' },
    scheduletrigger: { label: '스케줄', icon: <Calendar className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
    schedule: { label: '스케줄', icon: <Calendar className="w-4 h-4" />, color: 'text-orange-600 bg-orange-50' },
    knowledge: { label: '지식검색', icon: <Database className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
    slackpost: { label: 'Slack', icon: <MessageSquare className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
    slack: { label: 'Slack', icon: <MessageSquare className="w-4 h-4" />, color: 'text-pink-600 bg-pink-50' },
    email: { label: '이메일', icon: <Mail className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
    workflow: { label: '워크플로우', icon: <Bot className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
    template: { label: '템플릿', icon: <FileText className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50' },
    variableextraction: { label: '변수 추출', icon: <BookOpen className="w-4 h-4" />, color: 'text-cyan-600 bg-cyan-50' },
  };
  
  // Try exact match first
  if (mapping[nodeType]) {
    return mapping[nodeType];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(mapping)) {
    if (nodeType.includes(key) || key.includes(nodeType)) {
      return value;
    }
  }
  
  // Fallback: show cleaned up type
  return { 
    label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1), 
    icon: <BrainCircuit className="w-4 h-4" />, 
    color: 'text-gray-600 bg-gray-50' 
  };
};
