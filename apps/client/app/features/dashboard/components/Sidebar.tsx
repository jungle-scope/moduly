'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search,
  Wrench,
  BookOpen, // Changed from Library to BookOpen (from remote)
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plus,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    name: '참고자료',
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

  const handleCreateApp = () => {
    router.push('/dashboard');
    // Trigger the create app modal
    const event = new CustomEvent('openCreateAppModal');
    window.dispatchEvent(event);
  };

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-300 dark:border-gray-800 dark:bg-gray-950',
        isCollapsed ? 'w-20' : 'w-64',
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-white"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>

      {/* Logo/Brand */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-gray-200 dark:border-gray-800',
          isCollapsed ? 'justify-center px-0' : 'px-6',
        )}
      >
        <h1
          className={cn(
            'font-bold text-gray-900 dark:text-white transition-all duration-300',
            isCollapsed ? 'text-sm' : 'text-xl',
          )}
        >
          {isCollapsed ? 'M' : 'Moduly'}
        </h1>
      </div>

      {/* Create Button Section */}
      <div className={cn('px-4 py-3 mt-4', isCollapsed && 'px-2')}>
        <button
          onClick={handleCreateApp}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-lg transition-colors text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700',
            isCollapsed ? 'px-0 py-3' : 'px-4 py-2',
          )}
          title="Create App"
          aria-label="Create App"
        >
          <Plus className="w-4 h-4" />
          {!isCollapsed && <span>Create</span>}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors',
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3',
                isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white',
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800 mb-safe">
        {!isCollapsed && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            © 2025 Moduly
          </p>
        )}
      </div>
    </aside>
  );
}
