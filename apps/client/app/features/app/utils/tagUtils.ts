import { App } from '../api/appApi';

export interface ModuleTag {
  label: string;
  type:
    | 'api'
    | 'webhook'
    | 'webapp'
    | 'widget'
    | 'workflow_node'
    | 'schedule'
    | 'undeployed';
}

export interface DeploymentBadgeInfo {
  label: string;
  bgColor: string;
  textColor: string;
}

const DEPLOYMENT_BADGE_MAP: Record<string, DeploymentBadgeInfo> = {
  api: {
    label: 'REST API',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  webhook: {
    label: '웹훅',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
  },
  webapp: {
    label: '웹 앱',
    bgColor: 'bg-pink-100',
    textColor: 'text-pink-700',
  },
  widget: {
    label: '챗봇',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
  workflow_node: {
    label: '서브 모듈',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
  },
  schedule: {
    label: '스케줄러',
    bgColor: 'bg-violet-100',
    textColor: 'text-violet-700',
  },
  mcp: { label: 'MCP', bgColor: 'bg-gray-100', textColor: 'text-gray-700' },
};

export function getDeploymentBadgeInfo(type: string): DeploymentBadgeInfo {
  return (
    DEPLOYMENT_BADGE_MAP[type] || {
      label: type.toUpperCase(),
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
    }
  );
}

export function getModuleTags(app: App): ModuleTag[] {
  const tags: ModuleTag[] = [];

  // 배포 방식 태그 (가장 마지막에 설정한 하나만)
  if (app.active_deployment_type) {
    const deploymentTagMap: Record<
      string,
      { label: string; type: ModuleTag['type'] }
    > = {
      api: { label: 'REST API', type: 'api' },
      webhook: { label: '웹훅', type: 'webhook' },
      webapp: { label: '웹 앱', type: 'webapp' },
      widget: { label: '챗봇', type: 'widget' },
      workflow_node: { label: '서브 모듈', type: 'workflow_node' },
      schedule: { label: '스케줄러', type: 'schedule' },
      // mcp는 현재 태그로 표시하지 않음
    };

    const tag = deploymentTagMap[app.active_deployment_type];
    if (tag) tags.push(tag);
  } else {
    tags.push({ label: '미배포', type: 'undeployed' });
  }

  return tags;
}
