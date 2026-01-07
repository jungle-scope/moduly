import { FileText, Webhook, Database } from 'lucide-react';
import Image from 'next/image';

interface KnowledgeEmptyStateProps {
  onCreate: (initialTab?: 'FILE' | 'API' | 'DB') => void;
}

export default function KnowledgeEmptyState({
  onCreate,
}: KnowledgeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {/* Illustration */}
      <div className="relative w-64 h-64 mb-8">
        <Image
          src="/images/empty-knowledge.png"
          alt="Knowledge base illustration"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Main Text */}
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">
        AI 답변의 정확도를 높여보세요
      </h2>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-12 max-w-lg break-keep">
        보유하신 데이터를 연결하면 AI가 이를 학습하여,
        <br /> 질문에 대해 더 똑똑하고 근거 있는 답변을 제공합니다.
      </p>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl px-8">
        {/* File Upload Card */}
        <button
          onClick={() => onCreate('FILE')}
          className="flex flex-col items-center p-8 bg-blue-50/50 dark:bg-blue-900/10 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all group text-center"
        >
          <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            파일 업로드
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-keep">
            PDF, Excel, Word, TXT/MD 파일을 업로드하세요.
          </p>
        </button>

        {/* Web Link Card */}
        <button
          onClick={() => onCreate('API')}
          className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group text-center"
        >
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-full mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
            <Webhook className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            API 데이터 수집
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-keep">
            API 데이터를 가져오고, 클릭 한 번으로 지식을 최신화하세요.
          </p>
        </button>

        {/* DB Integration Card */}
        <button
          onClick={() => onCreate('DB')}
          className="flex flex-col items-center p-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group text-center"
        >
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-full mb-4 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
            <Database className="w-8 h-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            외부 DB 연동
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-keep">
            데이터베이스와 안전하게 연결하여 대규모 데이터를 동기화합니다.
          </p>
        </button>
      </div>
    </div>
  );
}
