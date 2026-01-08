import { App } from '../api/appApi';

export interface ModuleTag {
  label: string;
  type:
    | 'api'
    | 'webapp'
    | 'widget'
    | 'workflow_node'
    | 'undeployed'
    | 'knowledge';
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
      webapp: { label: '웹 앱', type: 'webapp' },
      widget: { label: '챗봇', type: 'widget' },
      workflow_node: { label: '서브 모듈', type: 'workflow_node' },
      // mcp는 현재 태그로 표시하지 않음
    };

    const tag = deploymentTagMap[app.active_deployment_type];
    if (tag) tags.push(tag);
  } else {
    tags.push({ label: '미배포', type: 'undeployed' });
  }

  // 지식 태그
  if (app.has_knowledge) {
    tags.push({ label: '지식', type: 'knowledge' });
  }

  return tags;
}
