
import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface JsonDataDisplayProps {
  data: any;
  level?: number;
  initiallyExpanded?: boolean;
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded hover:bg-gray-100"
      title="복사"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
};

const ValueRenderer = ({ value }: { value: any }) => {
  if (value === null) return <span className="text-gray-400 italic">null</span>;
  if (value === undefined)
    return <span className="text-gray-400 italic">undefined</span>;
  if (typeof value === 'boolean')
    return (
      <span className={value ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
        {String(value)}
      </span>
    );
  if (typeof value === 'number')
    return <span className="text-blue-600 font-mono">{value}</span>;
  if (typeof value === 'string') {
    // URL 감지
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      );
    }
    // 긴 텍스트 처리
    if (value.length > 100) {
      return <LongStringRenderer value={value} />;
    }
    return <span className="text-green-700 break-all">"{value}"</span>;
  }
  return <span className="text-gray-600">{String(value)}</span>;
};

const LongStringRenderer = ({ value }: { value: string }) => {
  const [expanded, setExpanded] = useState(false);
  const preview = value.slice(0, 100) + '...';

  return (
    <div className="inline-block align-top">
      <span className="text-green-700 break-all">
        "{expanded ? value : preview}"
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 border border-gray-200 inline-flex items-center gap-1"
      >
        {expanded ? (
          <>
            <Minimize2 className="w-3 h-3" /> 접기
          </>
        ) : (
          <>
            <Maximize2 className="w-3 h-3" /> 전체보기
          </>
        )}
      </button>
    </div>
  );
};

export const JsonDataDisplay = ({
  data,
  level = 0,
  initiallyExpanded = true,
}: JsonDataDisplayProps) => {
  const [expanded, setExpanded] = useState(
    level === 0 ? true : initiallyExpanded
  );

  // 기본 타입 처리
  if (
    data === null ||
    data === undefined ||
    typeof data !== 'object'
  ) {
    return (
      <div className="flex items-center gap-2 group">
        <ValueRenderer value={data} />
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={String(data)} />
        </div>
      </div>
    );
  }

  // 배열/객체 처리
  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  if (isEmpty) {
    return (
      <span className="text-gray-500 text-xs">
        {isArray ? '[]' : '{}'} <span className="italic">(empty)</span>
      </span>
    );
  }

  return (
    <div className={`text-xs font-mono select-text`}>
      <div
        className={`flex items-start gap-1 py-0.5 ${
          level > 0 ? 'cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        <button className="mt-0.5 text-gray-400 hover:text-gray-600">
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">
              {isArray ? `Array(${keys.length})` : `Object {${keys.length}}`}
            </span>
            {!expanded && (
              <span className="text-gray-400 text-[10px]">...</span>
            )}
            <div className="opacity-0 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
               <CopyButton text={JSON.stringify(data, null, 2)} />
            </div>
          </div>

          {expanded && (
            <div className="pl-2 mt-1 border-l-2 border-gray-100 space-y-1">
              {keys.map((key) => {
                const value = data[key];
                const isComplex =
                  value !== null &&
                  typeof value === 'object' &&
                  Object.keys(value).length > 0;

                return (
                  <div key={key} className="flex gap-2 items-start group/item">
                    <div className="min-w-[4rem] max-w-[12rem] text-gray-500 font-semibold truncate shrink-0 pt-0.5" title={key}>
                      {key}:
                    </div>
                    <div className="flex-1 min-w-0">
                      <JsonDataDisplay
                        data={value}
                        level={level + 1}
                        initiallyExpanded={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
