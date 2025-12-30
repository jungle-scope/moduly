
'use client';

import { useState } from 'react';
import { Search, Send, Bot, X, Loader2 } from 'lucide-react';
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

interface KnowledgeSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBaseId: string;
}

export default function KnowledgeSearchModal({
  isOpen,
  onClose,
  knowledgeBaseId,
}: KnowledgeSearchModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<RAGResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setResponse(null);

    try {
      // Call Backend API
      const res = await axios.post<RAGResponse>('http://localhost:8000/api/v1/rag/chat', {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            검색 시뮬레이터 (RAG 테스트)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Result Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
          {!response && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">질문을 입력하고 검색 버튼을 눌러보세요.</p>
              <p className="text-xs mt-2 opacity-60">ID: {knowledgeBaseId}</p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-medium">지식 베이스 검색 및 답변 생성 중...</p>
            </div>
          )}

          {response && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Answer Section */}
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">AI 답변</p>
                  <div className="text-gray-800 dark:text-gray-200 leading-relaxed bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    {response.answer}
                  </div>
                </div>
              </div>

              {/* References Section */}
              <div className="pl-12">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  참조 문서 ({response.references.length})
                </h4>
                <div className="grid gap-3">
                  {response.references.map((ref, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                          {ref.filename}
                        </span>
                        <span className="text-xs text-gray-400">
                          유사도: {(ref.similarity_score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 line-clamp-3 leading-relaxed text-xs">
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
          <div className="relative max-w-4xl mx-auto">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="지식 베이스에 대해 질문해보세요..."
              className="w-full pr-14 min-h-[60px] max-h-[120px] resize-none p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-black transition-all shadow-inner"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isLoading || !query.trim()}
              className="absolute bottom-3 right-3 h-10 w-10 flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-all shadow-md hover:shadow-lg disabled:shadow-none"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
