'use client';

import { useState, useRef, useEffect, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, FileText, Settings, Loader2 } from 'lucide-react';
import { knowledgeApi } from '@/app/features/knowledge/api/knowledgeApi';

interface CreateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  knowledgeBaseId?: string;
}

export default function CreateKnowledgeModal({
  isOpen,
  onClose,
  knowledgeBaseId,
}: CreateKnowledgeModalProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    chunkSize: 500,
    chunkOverlap: 50,
    embeddingModel: 'text-embedding-3-small',
    topK: 5,
    similarity: 0.7,
  });

  const [isLoading, setIsLoading] = useState(false);

  // API에서 가져온 임베딩 모델 옵션
  type EmbeddingModel = {
    id: string;
    model_id_for_api_call: string;
    name: string;
    provider_name?: string;
  };
  const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 50MB 제한 (bytes)
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // 사용 가능한 임베딩 모델 가져오기
  useEffect(() => {
    const fetchEmbeddingModels = async () => {
      try {
        setLoadingModels(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/llm/my-embedding-models`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          },
        );
        if (res.ok) {
          const json = await res.json();
          setEmbeddingModels(json);
          // 모델이 있고 현재 기본값이 목록에 없으면 첫 번째 모델로 설정
          if (json.length > 0 && !json.find((m: EmbeddingModel) => m.model_id_for_api_call === formData.embeddingModel)) {
            setFormData(prev => ({ ...prev, embeddingModel: json[0].model_id_for_api_call }));
          }
        } else {
          console.error('Failed to fetch embedding models');
        }
      } catch (err) {
        console.error('Error fetching embedding models', err);
      } finally {
        setLoadingModels(false);
      }
    };

    if (isOpen) {
      fetchEmbeddingModels();
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        alert('파일 크기는 50MB를 초과할 수 없습니다.');
        e.target.value = ''; // 초기화
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.size > MAX_FILE_SIZE) {
        alert('파일 크기는 50MB를 초과할 수 없습니다.');
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      alert('파일을 업로드해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Creating knowledge base:', { file, ...formData });

      const response = await knowledgeApi.uploadKnowledgeBase({
        file: file,
        name: formData.name,
        description: formData.description,
        embeddingModel: formData.embeddingModel,
        topK: formData.topK,
        similarity: formData.similarity,
        chunkSize: formData.chunkSize,
        chunkOverlap: formData.chunkOverlap,
        knowledgeBaseId: knowledgeBaseId,
      });

      // 성공 시 모달 닫기 및 문서 설정 페이지로 이동
      onClose();
      router.push(
        `/dashboard/knowledge/${response.knowledge_base_id}/document/${response.document_id}`,
      );
    } catch (error) {
      console.error('Failed to create/upload knowledge base:', error);
      alert('요청 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {knowledgeBaseId ? '문서 추가' : '지식 베이스 생성'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📁 파일 업로드
            </label>
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">
                    파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    PDF, Excel, Word, TXT/MD 등 (최대 50MB)
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.txt,.md,.docx,.xlsx,.xls,.csv"
              />
            </div>
          </div>

          {/* Basic Info (Only for New KB) */}
          {!knowledgeBaseId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📝 기본 정보
              </label>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="예: 제품 매뉴얼"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    설명
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="이 지식 베이스에 대한 설명을 입력하세요"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              <Settings className="w-4 h-4" />
              고급 설정
            </label>

            <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              {/* Chunk Settings */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  청크 설정
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      크기 (토큰)
                    </label>
                    <input
                      type="number"
                      value={formData.chunkSize}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          chunkSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      오버랩 (토큰)
                    </label>
                    <input
                      type="number"
                      value={formData.chunkOverlap}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          chunkOverlap: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Embedding Settings */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  임베딩 설정
                </h4>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    모델
                  </label>
                  {loadingModels ? (
                    <div className="text-xs text-gray-400 p-2">모델 로딩 중...</div>
                  ) : embeddingModels.length === 0 ? (
                    <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                      <span>사용 가능한 임베딩 모델이 없습니다.</span>
                      <a
                        href="/settings/provider"
                        className="ml-2 underline hover:text-amber-700 dark:hover:text-amber-300"
                      >
                        API 키 등록하기
                      </a>
                    </div>
                  ) : (
                    <select
                      value={formData.embeddingModel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          embeddingModel: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {embeddingModels.map((model) => (
                        <option key={model.id} value={model.model_id_for_api_call}>
                          {model.name} {model.provider_name ? `(${model.provider_name})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Search Settings */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  검색 설정
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Top K
                    </label>
                    <input
                      type="number"
                      value={formData.topK}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          topK: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      유사도 임계값
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.similarity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          similarity: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || embeddingModels.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : knowledgeBaseId ? (
              '추가하기'
            ) : (
              '생성하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
