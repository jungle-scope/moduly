'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  Wrench,
  BookOpen,
  BarChart3,
  Puzzle,
  Home,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './Logo';

const navigationItems = [
  {
    name: '홈',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: '내 모듈',
    href: '/dashboard/mymodule',
    icon: Puzzle,
  },
  {
    name: '마켓플레이스',
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

  return (
    <aside className="flex h-full w-52 flex-col bg-gradient-to-b from-blue-50 via-white to-blue-50/30 border-r border-gray-200">
      {/* Logo */}
      <Logo />

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
                'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors gap-3 px-3',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800 mb-safe">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          © 2025 Moduly
        </p>
      </div>
    </aside>
  );
}
