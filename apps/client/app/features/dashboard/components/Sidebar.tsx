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
  Menu,
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
  const [isCollapsed, setIsCollapsed] = useState(false);
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
    <aside
      className={cn(
        'flex h-full flex-col bg-blue-50 rounded-3xl transition-all duration-300 relative',
        isCollapsed ? 'w-[80px]' : 'w-[270px]',
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'absolute z-50 p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-300',
          isCollapsed ? 'left-1/2 -translate-x-1/2 top-8' : 'right-4 top-8',
        )}
      >
        <Menu className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
      </button>

      {/* Logo */}
      {isCollapsed ? <div className="h-[88px] w-full" /> : <Logo />}

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
                'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors gap-3',
                isCollapsed ? 'justify-center px-2' : 'px-3',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User Info Footer */}
      <div
        className={cn(
          'border-t border-gray-200 p-4 dark:border-gray-800 mb-safe relative transition-all',
          isCollapsed && 'items-center justify-center',
        )}
        ref={dropdownRef}
      >
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg hover:bg-gray-50 transition-colors text-left',
            isCollapsed ? 'justify-center p-0' : 'p-2',
          )}
        >
          <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
            <img
              src="https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YXNpYW58ZW58MHx8MHx8fDI%3D"
              alt={userName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {userEmail || '사용자'}
              </p>
            </div>
          )}
        </button>

        {/* Dropdown Menu (Upwards) */}
        {isDropdownOpen && (
          <div
            className={cn(
              'absolute bottom-full mb-2 w-full z-50',
              isCollapsed ? 'left-10 w-48' : 'left-0 px-2',
            )}
          >
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
