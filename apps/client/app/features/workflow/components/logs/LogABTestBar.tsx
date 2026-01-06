import { WorkflowRun } from '@/app/features/workflow/types/Api';
import { FlaskConical, MousePointerClick, X, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface LogABTestBarProps {
    isOpen: boolean;
    onToggle: () => void;
    runA: WorkflowRun | null;
    runB: WorkflowRun | null;
    selectionTarget: 'A' | 'B' | null;
    onSelectTarget: (target: 'A' | 'B' | null) => void;
    onCompare: () => void;
    onReset: () => void;
}

export const LogABTestBar = ({
    isOpen,
    onToggle,
    runA,
    runB,
    selectionTarget,
    onSelectTarget,
    onCompare,
    onReset
}: LogABTestBarProps) => {

    if (!isOpen) {
        return (
            <button 
                onClick={onToggle}
                className="w-full mb-4 py-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 text-blue-600 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow group"
            >
                <FlaskConical className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span>A/B 테스트 (실행 비교)</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full group-hover:bg-blue-200">클릭</span>
            </button>
        );
    }

    const isReady = runA && runB;

    const renderSlot = (target: 'A' | 'B', run: WorkflowRun | null) => {
        const isSelecting = selectionTarget === target;
        
        return (
            <div 
                onClick={() => onSelectTarget(isSelecting ? null : target)}
                className={`
                    flex-1 relative p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-start gap-2 h-28 justify-center
                    ${isSelecting 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 ring-offset-2' 
                        : run 
                            ? 'border-gray-200 bg-white hover:border-gray-300' 
                            : 'border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                    }
                `}
            >
                {isSelecting && (
                    <div className="absolute -top-3 left-4 bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full animate-bounce">
                        Selecting...
                    </div>
                )}

                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelecting ? 'text-blue-700' : 'text-gray-500'}`}>
                    Run {target} {target === 'A' ? '(기준)' : '(비교군)'}
                </span>

                {run ? (
                    <div className="w-full">
                        <div className="font-bold text-gray-800 truncate">
                            {new Date(run.started_at).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-mono bg-gray-100 px-1 rounded">{run.id.slice(0, 8)}</span>
                            {run.status === 'success' ? (
                                <span className="text-green-600">성공</span>
                            ) : (
                                <span className="text-red-600">실패</span>
                            )}
                            {run.workflow_version && (
                                <span className="text-indigo-600">v{run.workflow_version}</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                        <MousePointerClick className="w-5 h-5" />
                        <span className="text-sm font-medium">
                            {isSelecting ? '목록에서 선택하세요' : '눌러서 선택하기'}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full mb-4 bg-white border border-blue-100 rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-top-2">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-800 font-bold">
                    <FlaskConical className="w-5 h-5" />
                    A/B 테스트 설정
                </div>
                <button 
                    onClick={() => { onReset(); onToggle(); }}
                    className="p-1 hover:bg-white/50 rounded-full text-blue-400 hover:text-blue-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                    {renderSlot('A', runA)}
                    
                    <div className="text-gray-300">
                        <ArrowRight className="w-6 h-6" />
                    </div>

                    {renderSlot('B', runB)}
                </div>

                {selectionTarget && (
                    <div className="text-center text-sm text-blue-600 bg-blue-50 py-2 rounded-lg animate-pulse mb-4">
                        👇 아래 목록에서 <strong>Run {selectionTarget}</strong>로 사용할 항목을 클릭하세요.
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={onCompare}
                        disabled={!isReady}
                        className={`
                            px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all
                            ${isReady 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:scale-105' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                        `}
                    >
                        <ArrowLeftRight className="w-4 h-4" />
                        비교 분석 시작
                    </button>
                </div>
            </div>
        </div>
    );
};
