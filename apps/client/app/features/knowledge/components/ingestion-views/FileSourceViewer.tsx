import React from 'react';
import { FileText } from 'lucide-react';

interface FileSourceViewerProps {
  kbId: string;
  documentId: string;
}

export default function FileSourceViewer({
  kbId,
  documentId,
}: FileSourceViewerProps) {
  if (!kbId || !documentId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
        <FileText className="w-12 h-12 opacity-20" />
        <p>문서를 불러오는 중입니다...</p>
      </div>
    );
  }

  // Next.js Rewrite(Proxy)를 타도록 상대 경로 사용 (쿠키 전달 문제 해결)
  const baseUrl = '';

  return (
    <iframe
      src={`${baseUrl}/api/v1/knowledge/${kbId}/documents/${documentId}/content`}
      className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
      title="Original Document Preview"
    />
  );
}
