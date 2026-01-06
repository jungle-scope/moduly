import { WorkflowNodeRun } from '@/app/features/workflow/types/Api';
import { 
    CheckCircle2, 
    XCircle,
    ArrowRight,
    PlayCircle
} from 'lucide-react';
import React from 'react';
import { getNodeDisplayInfo } from '@/app/features/workflow/utils/nodeDisplayUtils';

interface LogExecutionPathProps {
    nodeRuns: WorkflowNodeRun[];
    onNodeSelect: (nodeId: string) => void;
    selectedNodeId: string | null;
    readOnly?: boolean;
}

export const LogExecutionPath = ({ nodeRuns, onNodeSelect, selectedNodeId, readOnly = false }: LogExecutionPathProps) => {
    // 1. 노드 순서 정렬 (started_at 기준)
    const sortedNodes = [...nodeRuns].sort((a, b) => 
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    return (
        <div className="flex items-center w-full overflow-x-auto p-4 no-scrollbar">
            {sortedNodes.map((node, index) => {
                const isSelected = selectedNodeId === node.node_id;
                const isLast = index === sortedNodes.length - 1;
                const displayInfo = getNodeDisplayInfo(node.node_type);
                
                // Status icon and color
                let StatusIcon = PlayCircle;
                let statusBorderColor = 'border-blue-200';

                if (node.status === 'success') {
                    StatusIcon = CheckCircle2;
                    statusBorderColor = 'border-green-200';
                } else if (node.status === 'failed') {
                    StatusIcon = XCircle;
                    statusBorderColor = 'border-red-200';
                }

                const content = (
                    <>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${displayInfo.color}`}>
                            {displayInfo.icon}
                            <span className="text-xs font-semibold whitespace-nowrap">
                                {displayInfo.label}
                            </span>
                        </div>
                        <div className={`p-0.5 rounded-full ${node.status === 'success' ? 'bg-green-100' : node.status === 'failed' ? 'bg-red-100' : 'bg-blue-100'}`}>
                            <StatusIcon className={`w-3 h-3 ${node.status === 'success' ? 'text-green-500' : node.status === 'failed' ? 'text-red-500' : 'text-blue-500'}`} />
                        </div>
                    </>
                );

                const commonClasses = `
                    group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : `bg-white hover:border-blue-300 ${statusBorderColor}`}
                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                `;

                return (
                    <React.Fragment key={`${node.node_id}-${index}`}>
                        {readOnly ? (
                            <div className={commonClasses}>
                                {content}
                            </div>
                        ) : (
                            <button 
                                onClick={() => onNodeSelect(node.node_id)}
                                className={commonClasses}
                            >
                                {content}
                            </button>
                        )}
                        
                        {!isLast && (
                            <ArrowRight className="w-4 h-4 text-gray-300 mx-1 shrink-0" />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
