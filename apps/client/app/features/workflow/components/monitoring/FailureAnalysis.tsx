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
        <thead className="bg-gray-50 text-gray-500 font-medium">
          <tr>
            <th className="px-4 py-3 whitespace-nowrap rounded-l-lg">노드</th>
            <th className="px-4 py-3 whitespace-nowrap">실패 횟수</th>
            <th className="px-4 py-3 whitespace-nowrap rounded-r-lg">
              주요 실패 원인
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {failures.map((item, idx) => {
            const displayInfo = getNodeDisplayInfo(item.node);

            return (
              <tr key={idx} className="bg-white hover:bg-gray-50">
                <td className="px-4 py-4 font-medium text-gray-900">
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded ${displayInfo.color}`}
                  >
                    {displayInfo.icon}
                    {displayInfo.label}
                  </span>
                </td>
                <td className="px-4 py-4 font-bold text-red-600">
                  {item.count}회
                </td>
                <td className="px-4 py-4 text-gray-500">{item.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
