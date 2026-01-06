import React from 'react';
import { getNodeDisplayInfo } from '@/app/features/workflow/utils/nodeDisplayUtils';

interface Props {
  failures: {
    node: string;
    count: number;
    reason: string;
  }[];
}

export const FailureAnalysis = ({ failures }: Props) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 whitespace-nowrap">노드</th>
                        <th className="px-6 py-3 whitespace-nowrap">실패 횟수</th>
                        <th className="px-6 py-3 whitespace-nowrap">주요 실패 원인</th>
                    </tr>
                </thead>
                <tbody>
                    {failures.map((item, idx) => {
                        const displayInfo = getNodeDisplayInfo(item.node);
                        
                        return (
                        <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">
                                <span className={`inline-flex items-center gap-2 px-2 py-1 rounded ${displayInfo.color}`}>
                                    {displayInfo.icon}
                                    {displayInfo.label}
                                </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-red-600">{item.count}회</td>
                            <td className="px-6 py-4 text-gray-500">{item.reason}</td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
