'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  ClockIcon,
} from '@/app/features/workflow/components/icons';
import { useWorkflowStore } from '@/app/features/workflow/store/useWorkflowStore';
import {
  validateVariableName,
  validateVariableSettings,
} from '../nodes/start/hooks/useVariableManager';
import { StartNodeData } from '../../types/Nodes';

export default function EditorHeader() {
  const router = useRouter();
  const { projectName, projectIcon, nodes } = useWorkflowStore();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleVersionHistory = useCallback(() => {
    // TODO: Implement version history
  }, []);

  const handlePublish = useCallback(() => {
    // TODO: Implement publish functionality
  }, []);

  const handleTestRun = useCallback(() => {
    setErrorMsg(null);
    // 1. StartNode 찾기
    const startNode = nodes.find((node) => node.type === 'startNode');
    if (!startNode) {
      const errorContent =
        '시작 노드를 찾을 수 없습니다. 워크플로우에 시작 노드를 추가해주세요.';
      console.warn('start node가 없습니다.');
      setErrorMsg(errorContent);
      return;
    }
    // 2. 유효성 검사
    const data = startNode.data as StartNodeData;
    const variables = data.variables || [];
    for (const variable of variables) {
      const otherNames = variables
        .filter((v) => v.id !== variable.id)
        .map((v) => v.name);
      let error = validateVariableName(
        variable.name,
        variable.label,
        otherNames,
      );
      if (!error) {
        error = validateVariableSettings(
          variable.type,
          variable.options,
          variable.maxLength,
        );
      }
      if (error) {
        const errorContent = `유효성 검사 실패: [${variable.label || variable.name}] ${error}`;
        console.warn(errorContent);
        setErrorMsg(errorContent);
        return;
      }
    }
    // 3. 성공 시 콘솔 출력
    console.log('[테스트 실행] 전체 데이터를 출력합니다.. ');
    console.log(JSON.stringify(nodes, null, 2));
    alert('테스트 데이터가 브라우저 콘솔(F12)에 출력되었습니다!');
  }, [nodes]);

  return (
    <div>
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
            <div className="flex items-center justify-center w-8 h-8 text-lg rounded-lg bg-gradient-to-br from-orange-400 to-pink-500">
              {projectIcon}
            </div>
            <h1 className="text-lg font-semibold text-gray-800">
              {projectName}
            </h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestRun}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            TEST
          </button>
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

      <div>
        {/* 에러 메시지 배너 */}
        {errorMsg && (
          <div className="fixed top-16 right-4 z-[60] bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded shadow-md max-w-sm animate-bounce">
            <strong className="font-bold mr-1">오류!</strong>
            <span className="block sm:inline text-sm">{errorMsg}</span>
            <button
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
              onClick={() => setErrorMsg(null)}
            >
              <span className="text-red-500 font-bold">×</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
