'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';

export default function EditorHeader() {
  const router = useRouter();
  const { projectApp } = useWorkflowStore();

  return (
    <header className="h-14 min-h-[56px] bg-gradient-to-r from-blue-50 via-white to-blue-50/30 flex items-center px-4 pt-1 justify-between relative z-50">
      {/* 1. Left: Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm ml-2">
        <button
          onClick={() => router.push('/dashboard/mymodule')}
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          내 모듈
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">
          {projectApp?.name || '이름 없는 모듈'}
        </span>
      </nav>
    </header>
  );
}
