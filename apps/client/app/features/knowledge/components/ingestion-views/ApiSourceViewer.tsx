import React, { useState } from 'react';

interface ApiSourceViewerProps {
  apiOriginalData: any;
  apiConfig?: any;
}

// JSON 트리 뷰어 컴포넌트
const JsonTreeViewer = ({ data }: { data: any }) => {
  if (data === null) return <span className="text-gray-400">null</span>;
  if (typeof data !== 'object') {
    const isString = typeof data === 'string';
    return (
      <span
        className={
          isString
            ? 'text-green-600 dark:text-green-400'
            : 'text-blue-600 dark:text-blue-400'
        }
      >
        {isString ? `"${data}"` : String(data)}
      </span>
    );
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isExpanded, setIsExpanded] = useState(true);
  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;
  if (isEmpty)
    return <span className="text-gray-500">{isArray ? '[]' : '{}'}</span>;
  return (
    <div className="font-mono text-xs ml-4">
      <div
        className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-1"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <span className="text-gray-500 font-bold">{isArray ? '[' : '{'}</span>
        {!isExpanded && <span className="text-gray-400 m-1">...</span>}
        {!isExpanded && (
          <span className="text-gray-500 font-bold">{isArray ? ']' : '}'}</span>
        )}
        {!isExpanded && (
          <span className="text-gray-400 ml-2 text-[10px]">
            {keys.length} items
          </span>
        )}
      </div>
      {isExpanded && (
        <div className="border-l border-gray-200 dark:border-gray-700 pl-2">
          {keys.map((key, idx) => (
            <div key={key} className="my-1 flex items-start">
              <span className="text-purple-600 dark:text-purple-400 mr-1">
                {key}:
              </span>
              <JsonTreeViewer data={data[key]} />
              {idx < keys.length - 1 && (
                <span className="text-gray-400">,</span>
              )}
            </div>
          ))}
          <div className="text-gray-500 font-bold">{isArray ? ']' : '}'}</div>
        </div>
      )}
    </div>
  );
};

export default function ApiSourceViewer({
  apiOriginalData,
  apiConfig,
}: ApiSourceViewerProps) {
  return (
    <div className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-auto p-4">
      <div className="p-4">
        {apiOriginalData ? (
          <JsonTreeViewer data={apiOriginalData} />
        ) : (
          <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200">
            {apiConfig
              ? JSON.stringify(apiConfig, null, 2)
              : 'API 데이터를 불러오는 중이거나 미리보기가 없습니다.'}
          </pre>
        )}
      </div>
    </div>
  );
}
