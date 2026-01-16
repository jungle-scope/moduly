import { DeploymentType } from '../../workflow/types/Deployment';

interface TagProps {
  label: string;
  type: DeploymentType | 'undeployed';
}

export function Tag({ label, type }: TagProps) {
  const colors = {
    api: 'bg-blue-100 text-blue-700',
    webapp: 'bg-purple-100 text-purple-700',
    widget: 'bg-green-100 text-green-700',
    workflow_node: 'bg-teal-100 text-teal-700',
    webhook: 'bg-orange-100 text-orange-700',
    schedule: 'bg-indigo-100 text-indigo-700',
    undeployed: 'bg-gray-100 text-gray-600',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${colorClasses}`}
    >
      {label}
    </span>
  );
}
