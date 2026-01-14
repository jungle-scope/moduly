import { getDeploymentBadgeInfo } from '../utils/tagUtils';

interface TagProps {
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

export function Tag({ label, type }: TagProps) {
  // 'undeployed'는 배포 타입이 아니므로 별도 처리
  const colorClasses =
    type === 'undeployed'
      ? 'bg-gray-100 text-gray-600'
      : `${getDeploymentBadgeInfo(type).bgColor} ${getDeploymentBadgeInfo(type).textColor}`;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colorClasses}`}
    >
      {label}
    </span>
  );
}
