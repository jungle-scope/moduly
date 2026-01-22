import { WorkflowRun } from "@/app/features/workflow/types/Api";
import { ArrowRightLeft, Scale } from "lucide-react";

interface LogComparatorProps {
  runA: WorkflowRun | null;
  runB: WorkflowRun | null;
  onClose: () => void;
}

export const LogComparator = ({ runA, runB, onClose }: LogComparatorProps) => {
  if (!runA || !runB) return null;

  return (
    <div className="flex flex-col h-full bg-white ">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shadow-sm z-10">
            <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-800">A/B 비교 분석</h2>
            </div>
            <button
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
                닫기
            </button>
        </div>

        {/* 바디 (2열 비교) */}
        <div className="flex-1 flex overflow-hidden">
            {/* Run A */}
            <div className="flex-1 p-4 border-r border-gray-200 overflow-y-auto bg-gray-50/30">
                <ComparisonColumn run={runA} label="Run A" color="blue" />
            </div>

            {/* Run B */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50/30">
                <ComparisonColumn run={runB} label="Run B" color="purple" />
            </div>
        </div>
    </div>
  );
};

const ComparisonColumn = ({ run, label, color }: { run: WorkflowRun, label: string, color: string }) => (
    <div className="space-y-4">
        <div className={`flex items-center justify-between pb-2 border-b border-${color}-200`}>
            <span className={`font-bold text-${color}-600 bg-${color}-50 px-2 py-1 rounded text-sm`}>{label}</span>
            <span className="text-xs text-gray-400">{run.id.slice(0,8)}</span>
        </div>

        {/* 메트릭 비교 */}
        <div className="grid grid-cols-2 gap-3">
             <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Duration</p>
                <p className="text-lg font-mono font-semibold">{run.duration?.toFixed(2)}s</p>
             </div>
             <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">Status</p>
                <p className={`text-lg font-bold ${run.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {run.status}
                </p>
             </div>
        </div>

        {/* 출력 비교 */}
        <div className="bg-white p-3 rounded border border-gray-200 shadow-sm">
            <p className="text-xs text-gray-500 mb-1 font-bold">Latest Output</p>
            <pre className="text-xs overflow-auto max-h-[300px] bg-gray-50 p-2 rounded border border-gray-100">
                {JSON.stringify(run.outputs, null, 2)}
            </pre>
        </div>
    </div>
);
