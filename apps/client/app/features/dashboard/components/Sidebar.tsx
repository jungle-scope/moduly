'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Wrench, BookOpen, BarChart3, Home } from 'lucide-react';

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

  return (
    <aside className="flex h-full w-52 flex-col bg-gradient-to-b from-blue-50 via-white to-blue-50/30">
      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 mb-safe">
        <p className="text-xs text-center text-gray-500">© 2025 Moduly</p>
      </div>
    </aside>
  );
}
