'use client';

import { useState } from 'react';
import { Search, Send, Bot, User, Loader2 } from 'lucide-react';
import axios from 'axios';

interface RAGResponse {
  answer: string;
  references: {
    content: string;
    filename: string;
    similarity_score: number;
    page_number?: number;
  }[];
}

interface SearchPlaygroundProps {
  knowledgeBaseId: string;
}

export default function SearchPlayground({ knowledgeBaseId }: SearchPlaygroundProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setResponse(null);

    try {
      // Call Backend API
      const res = await axios.post<RAGResponse>('http://localhost:8000/api/v1/rag/search-test/chat', {
        query: query,
        knowledge_base_id: knowledgeBaseId,
      });

      setResponse(res.data);
    } catch (error) {
      console.error('Search failed:', error);
      alert('검색 중 오류가 발생했습니다. 백엔드 로그를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          검색 시뮬레이터
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Knowledge Base ID: <span className="font-mono bg-gray-100 dark:bg-gray-900 px-1 py-0.5 rounded">{knowledgeBaseId}</span>
        </p>
      </div>

      {/* Result Area */}
      <div className="flex-1 p-6 overflow-y-auto min-h-[400px]">
        {!response && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Search className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">질문을 입력하고 검색 버튼을 눌러보세요.</p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-blue-600">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm font-medium">지식 베이스 검색 중...</p>
          </div>
        )}

        {response && (
          <div className="space-y-6">
            {/* Answer Section */}
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">AI 답변 (Mock)</p>
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg">
                  {response.answer}
                </div>
              </div>
            </div>

            {/* References Section */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Search className="w-4 h-4" />
                참조 문서 ({response.references.length})
              </h4>
              <div className="grid gap-3">
                {response.references.map((ref, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        {ref.filename}
                      </span>
                      <span className="text-xs text-gray-400">
                        유사도: {(ref.similarity_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed">
                      {ref.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지식 베이스에 대해 질문해보세요..."
            className="w-full pr-12 min-h-[80px] resize-none p-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSearch();
              }
            }}
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !query.trim()}
            className="absolute bottom-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
