import { AlertCircle } from 'lucide-react';

interface Props {
  failures: {
    node: string;
    count: number;
    reason: string;
    rate: string;
  }[];
}

export const FailureAnalysis = ({ failures }: Props) => {
    // const failures = [ ... ]; // Remove hardcoded data

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        <th className="px-6 py-3">Node Name</th>
                        <th className="px-6 py-3">Failure Count</th>
                        <th className="px-6 py-3">Primary Reason</th>
                        <th className="px-6 py-3">Failure Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {failures.map((item, idx) => (
                        <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                {item.node}
                            </td>
                            <td className="px-6 py-4">{item.count}</td>
                            <td className="px-6 py-4 text-gray-500">{item.reason}</td>
                            <td className="px-6 py-4 font-bold text-red-600">{item.rate}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
