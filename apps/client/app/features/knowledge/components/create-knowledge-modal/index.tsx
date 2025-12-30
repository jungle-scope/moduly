'use client';

import { useState, useRef, DragEvent } from 'react';
import { X, Upload, FileText, Settings, Loader2 } from 'lucide-react';
import { knowledgeApi } from '@/app/features/knowledge/api/knowledgeApi';

interface CreateKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateKnowledgeModal({
  isOpen,
  onClose,
}: CreateKnowledgeModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    chunkSize: 500,
    chunkOverlap: 50,
    embeddingModel: 'openai-ada-2',
    topK: 5,
    similarity: 0.7,
  });

  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
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

      await knowledgeApi.uploadKnowledgeBase({
        file: file,
        name: formData.name,
        description: formData.description,
        embeddingModel: formData.embeddingModel,
        topK: formData.topK,
        similarity: formData.similarity,
        chunkSize: formData.chunkSize,
        chunkOverlap: formData.chunkOverlap,
      });

      // 성공 시 모달 닫기 (부모 컴포넌트에서 리스트 갱신됨)
      onClose();
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      alert('지식 베이스 생성에 실패했습니다.');
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
            지식 베이스 생성
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
                    PDF, TXT, DOCX 등
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.txt,.docx,.md"
              />
            </div>
          </div>

          {/* Basic Info */}
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
                    <option value="openai-ada-2">OpenAI Ada-2</option>
                    <option value="openai-ada-3">OpenAI Ada-3</option>
                    <option value="cohere-embed">Cohere Embed</option>
                  </select>
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
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              '생성하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
