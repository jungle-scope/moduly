'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { authApi } from '../../auth/api/authApi';
import {
  Search,
  Settings,
  BookOpen,
  BarChart3,
  Puzzle,
  Home,
  LogOut,
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
    name: '지식 관리',
    href: '/dashboard/knowledge',
    icon: BookOpen,
  },
  {
    name: '설정',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [userName, setUserName] = useState('사용자');
  const [userEmail, setUserEmail] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userInfo = await authApi.me();
        if (userInfo.user?.name) {
          setUserName(userInfo.user.name);
        }
        if (userInfo.user?.email) {
          setUserEmail(userInfo.user.email);
        }
      } catch {
        // Silent error handling
      }
    };

    fetchUserInfo();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Silent error handling
    } finally {
      localStorage.removeItem('access_token');
      router.push('/auth/login');
    }
  };

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

      {/* User Info Footer */}
      <div
        className="border-t border-gray-200 p-4 dark:border-gray-800 mb-safe relative"
        ref={dropdownRef}
      >
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-xs">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {userEmail || '사용자'}
            </p>
          </div>
        </button>

        {/* Dropdown Menu (Upwards) */}
        {isDropdownOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-full px-2 z-50">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 overflow-hidden">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
