import { memo, useMemo } from 'react';
import { ValidationBadge } from '../../../ui/ValidationBadge';
import { hasIncompleteVariables } from '../../../../utils/validationUtils';
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
  get_pr: 'PR 가져오기',
  comment_pr: 'PR 코멘트',
};

export const GithubNode = memo(
  ({ data, selected }: NodeProps<Node<GithubNodeData>>) => {
    const action = data.action || 'get_pr';
    const actionClass = actionColors[action] || defaultActionColor;
    const actionName = actionNames[action] || action;

    const hasValidationIssue = useMemo(() => {
      const tokenMissing = !data.api_token?.trim();
      const ownerMissing = !data.repo_owner?.trim();
      const repoMissing = !data.repo_name?.trim();
      const prMissing = !data.pr_number;
      return (
        tokenMissing ||
        ownerMissing ||
        repoMissing ||
        prMissing ||
        hasIncompleteVariables(data.referenced_variables)
      );
    }, [
      data.api_token,
      data.repo_owner,
      data.repo_name,
      data.pr_number,
      data.referenced_variables,
    ]);

    return (
      <BaseNode
        data={data}
        selected={selected}
        showSourceHandle={true}
        icon={<Github className="text-white" />}
        iconColor="#333" // GitHub black
      >
        <div className="flex flex-col gap-2 p-1">
          {/* Action Badge */}
          <div
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border w-fit ${actionClass}`}
          >
            {actionName}
          </div>

          {hasValidationIssue && <ValidationBadge />}
        </div>
      </BaseNode>
    );
  },
);

GithubNode.displayName = 'GithubNode';
