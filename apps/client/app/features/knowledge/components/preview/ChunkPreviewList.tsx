import React from 'react';
import { Check, Loader2, Eye } from 'lucide-react';
import { DocumentSegment } from '@/app/features/knowledge/api/knowledgeApi';

interface ChunkPreviewListProps {
  previewSegments: DocumentSegment[];
  isLoading: boolean;
}

export default function ChunkPreviewList({
  previewSegments,
  isLoading,
}: ChunkPreviewListProps) {
  return (
    <div className="flex-1 bg-white dark:bg-gray-800 overflow-hidden flex flex-col">
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2">
          <Check className="w-4 h-4" />
          분할 결과 미리보기
        </h3>
        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
          {previewSegments.length}개 조각
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50 dark:bg-gray-900/20">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 animate-in fade-in">
            <Loader2 className="w-8 h-8 mb-2 animate-spin text-blue-500" />
            <p className="text-sm">문서를 분석하여 조각내고 있습니다...</p>
          </div>
        ) : previewSegments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-full mb-4">
              <Eye className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-1">
              미리보기 결과가 없습니다
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              왼쪽에서 설정 후{' '}
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                [결과 미리보기]
              </span>{' '}
              클릭
            </p>
          </div>
        ) : (
          previewSegments.map((segment, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-700/30 rounded-t-lg">
                <span className="text-xs font-semibold text-gray-500">
                  조각 #{idx + 1}
                </span>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span>{segment.char_count}자 (chars)</span>
                  <span>•</span>
                  <span>{segment.token_count}토큰 (tokens)</span>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {segment.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
