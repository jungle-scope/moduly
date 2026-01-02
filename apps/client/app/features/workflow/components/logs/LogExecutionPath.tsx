import { WorkflowNodeRun } from '@/app/features/workflow/types/Api';
import { 
    PlayCircle, 
    BrainCircuit, 
    Code2, 
    MessageSquare, 
    GitFork, 
    CheckCircle2, 
    XCircle,
    ArrowRight,
    Search, 
    Database
} from 'lucide-react';
import React from 'react';

interface LogExecutionPathProps {
    nodeRuns: WorkflowNodeRun[];
    onNodeSelect: (nodeId: string) => void;
    selectedNodeId: string | null;
    readOnly?: boolean;
}

export const LogExecutionPath = ({ nodeRuns, onNodeSelect, selectedNodeId, readOnly = false }: LogExecutionPathProps) => {
    // Helper to get Icon by node type
    const getNodeIcon = (type: string) => {
        const lower = type.toLowerCase();
        if (lower.includes('start')) return <PlayCircle className="w-4 h-4" />;
        if (lower.includes('llm')) return <BrainCircuit className="w-4 h-4" />;
        if (lower.includes('code')) return <Code2 className="w-4 h-4" />;
        if (lower.includes('template') || lower.includes('answer')) return <MessageSquare className="w-4 h-4" />;
        if (lower.includes('condition')) return <GitFork className="w-4 h-4" />;
        if (lower.includes('retriev') || lower.includes('rag')) return <Search className="w-4 h-4" />;
        if (lower.includes('db') || lower.includes('tool')) return <Database className="w-4 h-4" />;
        return <PlayCircle className="w-4 h-4" />;
    };
    
    // 1. 노드 순서 정렬 (started_at 기준)
    const sortedNodes = [...nodeRuns].sort((a, b) => 
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    );

    return (
        <div className="flex items-center w-full overflow-x-auto p-4 no-scrollbar">
            {sortedNodes.map((node, index) => {
                const isSelected = selectedNodeId === node.node_id;
                const isLast = index === sortedNodes.length - 1;
                
                // 아이콘 및 스타일 결정
                let Icon = PlayCircle;
                let statusColor = 'text-blue-500 bg-blue-50 border-blue-200';

                if (node.status === 'success') {
                    Icon = CheckCircle2;
                    statusColor = 'text-green-500 bg-green-50 border-green-200';
                } else if (node.status === 'failed') {
                    Icon = XCircle;
                    statusColor = 'text-red-500 bg-red-50 border-red-200';
                }

                // Node Type Label (간소화)
                const label = node.node_type.replace('Node', '');

                const content = (
                    <>
                        <div className={`p-1 rounded-full ${statusColor} bg-opacity-20`}>
                            <Icon className={`w-3 h-3 ${statusColor.split(' ')[0]}`} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                            {label}
                        </span>
                    </>
                );

                const commonClasses = `
                    group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}
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
