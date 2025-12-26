'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ClockIcon } from '../icons';
import { useEditorStore } from '@/store/editorStore';

export default function EditorHeader() {
  const router = useRouter();
  const { projectName, projectIcon } = useEditorStore();

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleVersionHistory = useCallback(() => {
    // TODO: Implement version history
  }, []);

  const handlePublish = useCallback(() => {
    // TODO: Implement publish functionality
  }, []);

  return (
    <header className="h-14 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-pink-500 rounded-lg flex items-center justify-center text-lg">
            {projectIcon}
          </div>
          <h1 className="text-lg font-semibold text-gray-800">{projectName}</h1>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleVersionHistory}
          className="px-4 py-2 flex items-center gap-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ClockIcon className="w-5 h-5" />
          <span className="text-sm font-medium">버전 기록</span>
        </button>

        <button
          onClick={handlePublish}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
        >
          게시하기
        </button>
      </div>
    </header>
  );
}
