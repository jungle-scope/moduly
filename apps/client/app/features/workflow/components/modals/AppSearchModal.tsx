import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { App } from '../../../../features/app/api/appApi';
import { workflowApi } from '../../api/workflowApi';
import { cn } from '@/lib/utils';

// 워크플로우 모듈로 불러올 앱을 검색하고 선택하는 모달 컴포넌트입니다.
// 현재 편집 중인 앱은 제외하고, 사용자가 접근 가능한 모든 앱(Public/Private)을 검색합니다.
interface AppSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (app: App) => void;
  excludedAppId?: string; // 현재 편집 중인 앱 ID (검색 결과 제외용)
}

export function AppSearchModal({
  isOpen,
  onClose,
  onSelect,
  excludedAppId,
}: AppSearchModalProps) {
  const [query, setQuery] = useState('');
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // 모달이 열릴 때 앱 목록 로드
  // TODO: 데이터가 많아지면 서버 사이드 검색으로 전환 고려
  useEffect(() => {
    if (isOpen) {
      const fetchApps = async () => {
        setIsLoading(true);
        try {
          // 백엔드에서 사용 가능한 "Workflow Nodes"를 직접 가져옵니다.
          // 버전, 스키마, deployment_id가 포함된 배포 정보를 반환합니다.
          // excludedAppId를 전달하여 백엔드에서 순환 참조를 방지합니다.
          const validApps = await workflowApi.listWorkflowNodes(excludedAppId);

          // UI 렌더링에 적합한 구조로 매핑합니다.
          // 현재는 node 구조를 그대로 사용하거나 필요한 인터페이스로 매핑합니다.
          // 'name', 'description', 'icon' 등이 필요합니다.
          // 백엔드의 list_workflow_node_deployments는 다음을 생성합니다:
          // { deployment_id, app_id, name, description, ... }
          // 'icon'이 없으므로 백엔드에도 추가해야 할 수 있습니다.
          // 현재는 누락된 경우 기본 아이콘을 사용합니다.

          const mappedApps = validApps.map((node) => ({
            ...node,
            id: node.app_id, // 키 값으로 사용
            icon: { content: '⚡️', background_color: '#f3f4f6' }, // 백엔드에서 아직 아이콘을 보내지 않으므로 기본 아이콘 사용
            active_deployment_id: node.deployment_id, // 노드 추가에 필수
          }));

          setApps(mappedApps as any); // State 타입을 즉시 다시 작성하지 않기 위해 any로 캐스팅
        } catch (error) {
          console.error('Failed to fetch apps:', error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchApps();

      // 상태 초기화
      setQuery('');
      setSelectedIndex(0);

      // 입력창 자동 포커스 (UX 향상)
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, excludedAppId]);

  // 앱 검색 필터링 (이름 및 설명 기준)
  // useMemo를 사용하여 검색어가 변경될 때만 필터링 수행
  const filteredApps = useMemo(() => {
    if (!query) return apps;
    const lowerQuery = query.toLowerCase();
    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(lowerQuery) ||
        (app.description && app.description.toLowerCase().includes(lowerQuery)),
    );
  }, [apps, query]);

  // 키보드 네비게이션 처리 (화살표 위/아래, 엔터, ESC)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredApps.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredApps[selectedIndex]) {
        onSelect(filteredApps[selectedIndex]);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // 검색어가 변경되면 선택 인덱스 초기화
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] sm:pt-[15vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all dark:bg-gray-900 dark:border dark:border-gray-800">
        {/* Search Header */}
        <div className="flex items-center border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <Search className="mr-3 h-5 w-5 text-gray-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-lg placeholder-gray-400 outline-none dark:text-gray-100"
            placeholder="Search for an app to import..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={onClose}
            className="ml-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : filteredApps.length > 0 ? (
            <ul className="space-y-1">
              {filteredApps.map((app, index) => (
                <li
                  key={app.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-colors',
                    index === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                  )}
                  onClick={() => {
                    onSelect(app);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-800"
                    style={{
                      backgroundColor: app.icon?.background_color,
                    }}
                  >
                    {app.icon?.content || '⚡️'}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="truncate font-medium text-gray-900 dark:text-gray-100">
                      {app.name}
                    </h4>
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {app.description || 'No description'}
                    </p>
                  </div>
                  {index === selectedIndex && (
                    <span className="text-xs text-gray-400">Press Enter</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              {query
                ? 'No apps found matching your search.'
                : 'No apps available.'}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          Use <kbd className="font-sans font-semibold">↓</kbd>{' '}
          <kbd className="font-sans font-semibold">↑</kbd> to navigate,{' '}
          <kbd className="font-sans font-semibold">Enter</kbd> to select,{' '}
          <kbd className="font-sans font-semibold">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}
