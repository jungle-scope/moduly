'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Wrench, BookOpen, BarChart3, Plus, Home } from 'lucide-react';

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

  const handleCreateApp = () => {
    router.push('/dashboard');
    // Trigger the create app modal
    const event = new CustomEvent('openCreateAppModal');
    window.dispatchEvent(event);
  };

  return (
    <aside className="flex h-full w-60 flex-col bg-gradient-to-b from-blue-50 via-white to-blue-50/30">
      <div className="px-4 py-3 mt-4">
        <button
          onClick={handleCreateApp}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium text-gray-700 "
        >
          <Plus className="w-4 h-4" />
          Create
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
    </aside>
  );
}
