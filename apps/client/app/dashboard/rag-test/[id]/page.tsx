interface Params {
  id: string;
}

import SearchPlayground from '@/app/features/knowledge/components/search-playground';

export default async function RagTestPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  return (
    <div className="h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            RAG 검색 테스트
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            이 페이지는 임시 테스트용입니다. 개발이 완료되면 삭제될 예정입니다.
          </p>
        </div>
        
        <div className="flex-1 min-h-0">
          <SearchPlayground knowledgeBaseId={id} />
        </div>
      </div>
    </div>
  );
}
