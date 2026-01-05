import { memo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Github } from 'lucide-react';
import { GithubNodeData } from '../../../../types/Nodes';
import { BaseNode } from '../../BaseNode';

// Action badge colors
const actionColors: Record<string, string> = {
  get_pr: 'bg-blue-100 text-blue-700 border-blue-200',
  comment_pr: 'bg-green-100 text-green-700 border-green-200',
};

const defaultActionColor = 'bg-gray-100 text-gray-700 border-gray-200';

// Action display names
const actionNames: Record<string, string> = {
  get_pr: 'Get PR',
  comment_pr: 'Comment',
};

export const GithubNode = memo(
  ({ data, selected }: NodeProps<Node<GithubNodeData>>) => {
    const action = data.action || 'get_pr';
    const actionClass = actionColors[action] || defaultActionColor;
    const actionName = actionNames[action] || action;

    return (
      <BaseNode
        data={data}
        selected={selected}
        showSourceHandle={true}
        icon={<Github className="text-white" />}
        iconColor="#333" // GitHub black
      >
        <div className="flex flex-col gap-2 p-1">
          {/* Action and Repo Preview */}
          <div className="flex items-center gap-2">
            <div
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${actionClass}`}
            >
              {actionName}
            </div>
            <div className="text-xs text-gray-600 flex-1 font-mono overflow-x-auto whitespace-nowrap scrollbar-hide">
              {data.repo_owner && data.repo_name
                ? `${data.repo_owner}/${data.repo_name}`
                : 'Repo를 설정하세요'}
            </div>
          </div>
          {data.pr_number && (
            <div className="text-[10px] text-gray-500">
              PR #{data.pr_number}
            </div>
          )}
        </div>
      </BaseNode>
    );
  },
);

GithubNode.displayName = 'GithubNode';
