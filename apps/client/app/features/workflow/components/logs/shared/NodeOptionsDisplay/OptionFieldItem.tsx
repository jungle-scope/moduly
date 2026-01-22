'use client';

import { FieldConfig } from './nodeDisplayConfig';

interface OptionFieldItemProps {
  label: string;
  value: any;
  type?: FieldConfig['type'];
  isEmpty: boolean;
}

/**
 * 개별 옵션 필드를 렌더링하는 컴포넌트
 */
export const OptionFieldItem = ({
  label,
  value,
  type,
  isEmpty,
}: OptionFieldItemProps) => {
  return (
    <div className="text-xs">
      <span className="font-semibold text-gray-700 block mb-1">{label}</span>
      {isEmpty ? (
        <div className="bg-white rounded border border-gray-200 p-2 min-h-[32px]" />
      ) : type === 'code' ? (
        <pre className="bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
          {value}
        </pre>
      ) : type === 'list' && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1">
          {value.map((v: any, i: number) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[11px]"
            >
              {v.name || v.id || JSON.stringify(v)}
            </span>
          ))}
        </div>
      ) : type === 'variables-table' && Array.isArray(value) ? (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left text-gray-600 font-medium">변수명</th>
                <th className="px-2 py-1 text-left text-gray-600 font-medium">표시명</th>
                <th className="px-2 py-1 text-left text-gray-600 font-medium">타입</th>
                <th className="px-2 py-1 text-center text-gray-600 font-medium">필수</th>
              </tr>
            </thead>
            <tbody>
              {value.map((v: any, i: number) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 font-mono text-gray-700">{v.name}</td>
                  <td className="px-2 py-1.5 text-gray-700">{v.label}</td>
                  <td className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                      {v.type}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {v.required ? (
                      <span className="text-red-600 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === 'input-mapping-table' && Array.isArray(value) ? (
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-1 text-left text-gray-600 font-medium">변수명</th>
                <th className="px-2 py-1 text-left text-gray-600 font-medium">소스</th>
              </tr>
            </thead>
            <tbody>
              {value.map((v: any, i: number) => (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 font-mono text-gray-700">{v.name || v.variable}</td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 text-[10px]">
                    {v.source || v.json_path || (v.value_selector ? v.value_selector.join(' → ') : JSON.stringify(v))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : type === 'json' ? (
        <pre className="bg-white rounded border border-gray-200 p-2 overflow-x-auto max-h-24 overflow-y-auto font-mono text-gray-600">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        // text 타입과 기본 타입(모델명 등) 모두 동일한 스타일 적용 (흰색 박스)
        <div className="bg-white rounded border border-gray-200 p-2 max-h-32 overflow-y-auto">
          <p className="text-gray-700 whitespace-pre-wrap font-mono text-[11px]">
            {String(value)}
          </p>
        </div>
      )}
    </div>
  );
};
