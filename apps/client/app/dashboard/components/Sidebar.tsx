'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Wrench, BookOpen, Pencil } from 'lucide-react';

const navigationItems = [
  {
    name: '스튜디오',
    href: '/dashboard',
    icon: Pencil,
  },
  {
    name: '탐색',
    href: '/dashboard/explore',
    icon: Search,
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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      {/* Logo/Brand */}
      <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Moduly
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © 2025 Moduly
        </p>
      </div>
    </aside>
  );
}
