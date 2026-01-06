'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Wrench,
  BookOpen,
  BarChart3,
  Plus,
  Home,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { workflowApi } from '@/app/features/workflow/api/workflowApi';

const navigationItems = [
  {
    name: '대시보드',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: '탐색',
    href: '/dashboard/explore',
    icon: Search,
  },
  {
    name: '통계',
    href: '/dashboard/statistics',
    icon: BarChart3,
  },
  {
    name: '지식',
    href: '/dashboard/knowledge',
    icon: BookOpen,
  },
  {
    name: '도구',
    href: '/dashboard/tools',
    icon: Wrench,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleCreateApp = async () => {
    try {
      setIsCreating(true);
      const newWorkflow = await workflowApi.createWorkflow({
        name: '새로운 워크플로우',
        description: '새로운 워크플로우입니다.',
      });
      toast.success('워크플로우가 생성되었습니다.');
      router.push(`/workflows/${newWorkflow.id}`);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      toast.error('워크플로우 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-gray-200 bg-gradient-to-b from-blue-50 via-white to-blue-50/30 transition-all duration-300 dark:border-gray-800 dark:bg-gray-950 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950',
        isCollapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        {isCollapsed ? (
          <ChevronsRight className="h-3 w-3 text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronsLeft className="h-3 w-3 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Logo/Brand (Optional - existing code didn't have one but develop did. Adding simple one) */}
      {!isCollapsed && (
        <div className="flex h-16 items-center px-6">
          <h1 className="text-xl font-bold text-gray-900 transition-all duration-300 dark:text-white">
            Moduly
          </h1>
        </div>
      )}

      {/* Create Button Section */}
      <div className={cn('px-4 py-3 mt-2', isCollapsed && 'px-2')}>
        <button
          onClick={handleCreateApp}
          disabled={isCreating}
          className={cn(
            'flex items-center justify-center rounded-lg bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-700 dark:hover:bg-blue-600',
            isCollapsed ? 'h-10 w-10 p-0' : 'h-10 w-full gap-2 px-4',
          )}
          title="새 워크플로우 생성"
        >
          <Plus className={cn('h-5 w-5', isCreating && 'animate-spin')} />
          {!isCollapsed && <span className="font-medium text-sm">Create</span>}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center rounded-lg transition-colors',
                isCollapsed
                  ? 'h-10 w-10 justify-center p-0 mx-auto'
                  : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon
                className={cn(
                  'shrink-0',
                  isActive
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-gray-500 dark:text-gray-400',
                  isCollapsed ? 'h-5 w-5' : 'h-5 w-5',
                )}
              />
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4 mb-safe dark:border-gray-800">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            © 2025 Moduly
          </p>
        </div>
      )}
    </aside>
  );
}
