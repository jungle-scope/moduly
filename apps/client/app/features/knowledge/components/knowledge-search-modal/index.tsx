'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Send, Bot, X, Loader2, Settings } from 'lucide-react';
import axios from 'axios';

const BASE_URL = '';

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

type ModelOption = {
  id: string;
  model_id_for_api_call: string;
  name: string;
  type: string;
  provider_name?: string;
};

export default function KnowledgeSearchModal({
  isOpen,
  onClose,
  knowledgeBaseId,
}: KnowledgeSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'search' | 'chat'>('search');

  // Separate states for persistence
  const [searchResult, setSearchResult] = useState<RAGResponse | null>(null);
  const [chatResult, setChatResult] = useState<RAGResponse | null>(null);

  // Derived state for current view
  const response = activeTab === 'chat' ? chatResult : searchResult;

  // Model Selection State
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);

  // Fetch Models (Only needed for Chat tab, but we fetch on mount anyway for simplicity)
  useEffect(() => {
    if (isOpen) {
      const fetchMyModels = async () => {
        try {
          setLoadingModels(true);
          const res = await fetch(`/api/v1/llm/my-models`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          if (res.ok) {
            const json = await res.json();
            // Chat 모델만 필터링
            const chatModels = json.filter((m: any) => m.type === 'chat');
            setModelOptions(chatModels);

            // 기본값 선택
            if (chatModels.length > 0) {
              const defaultModel =
                chatModels.find((m: any) =>
                  m.model_id_for_api_call.includes('gpt-4o'),
                ) || chatModels[0];
              setSelectedModelId(defaultModel.model_id_for_api_call);
            }
          }
        } catch (err) {
          console.error('Error fetching models', err);
        } finally {
          setLoadingModels(false);
        }
      };
      fetchMyModels();
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setIsLoading(true);
    if (activeTab === 'chat') setChatResult(null);
    else setSearchResult(null);

    try {
      const endpoint =
        activeTab === 'chat'
          ? '/api/v1/rag/search-test/chat'
          : '/api/v1/rag/search-test/pure';
      const payload: any = {
        query: query,
        knowledge_base_id: knowledgeBaseId,
      };

      // Chat 모드일 때만 generation_model 추가
      if (activeTab === 'chat') {
        payload.generation_model = selectedModelId;
      }

      // Call Backend API
      const res = await axios.post<RAGResponse>(
        `${BASE_URL}${endpoint}`,
        payload,
        { withCredentials: true },
      );

      // Response Handling
      if (activeTab === 'chat') {
        setChatResult(res.data as RAGResponse);
      } else {
        // Search 모드는 List[ChunkPreview]가 옴 -> RAGResponse 형태로 래핑해서 표시
        setSearchResult({
          answer: '', // 답변 없음
          references: res.data as any, // 문서 목록만 있음 (Type Casting)
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              참고자료 테스트
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs & Toolbar */}
          <div className="flex items-center justify-between px-4 pb-0">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab('search')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'search'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                일반 검색 (Hit Testing)
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'chat'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                AI 답변 (RAG Chat)
              </button>
            </div>

            {/* Model Selector (Only Visible in Chat Tab) */}
            {activeTab === 'chat' && (
              <div className="flex items-center gap-2 pb-2">
                {loadingModels ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : modelOptions.length > 0 ? (
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 min-w-[140px] focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {Object.entries(
                      modelOptions.reduce(
                        (acc, model) => {
                          const p = model.provider_name || 'Unknown';
                          if (!acc[p]) acc[p] = [];
                          acc[p].push(model);
                          return acc;
                        },
                        {} as Record<string, ModelOption[]>,
                      ),
                    ).map(([provider, models]) => (
                      <optgroup key={provider} label={provider.toUpperCase()}>
                        {models.map((m) => (
                          <option key={m.id} value={m.model_id_for_api_call}>
                            {m.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => router.push('/dashboard/settings')}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 bg-red-50 rounded border border-red-200"
                  >
                    <Settings className="w-3 h-3" />
                    설정 필요
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Result Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
          {!response && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-sm">
                {activeTab === 'search'
                  ? '검색어를 입력하면 관련 문서 청크를 찾습니다.'
                  : '질문을 입력하면 문서를 참고하여 AI가 답변합니다.'}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-blue-600">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-medium">
                지식 베이스 검색 및 답변 생성 중...
              </p>
            </div>
          )}

          {response && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Answer Section - Only visible in Chat mode */}
              {activeTab === 'chat' && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      AI 답변
                    </p>
                    <div className="text-gray-800 dark:text-gray-200 leading-relaxed bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                      {response.answer}
                    </div>
                  </div>
                </div>
              )}

              {/* References Section - Fixed padding for layout stability */}
              <div className="pl-12">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  참조 문서 ({response.references.length})
                </h4>
                <div className="grid gap-3">
                  {response.references.map((ref, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
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
              placeholder={
                activeTab === 'search'
                  ? '검색어를 입력하세요...'
                  : '지식 베이스에 대해 질문해보세요...'
              }
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
              disabled={
                isLoading ||
                !query.trim() ||
                (activeTab === 'chat' &&
                  !selectedModelId &&
                  modelOptions.length > 0)
              }
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
