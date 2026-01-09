'use client';

import { useRouter } from 'next/navigation';
import { Settings, LogOut } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { authApi } from '../../auth/api/authApi';
import Breadcrumb from './Breadcrumb';

export default function Header() {
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
      // Silent error handling - still clear local state and redirect
    } finally {
      localStorage.removeItem('access_token');
      router.push('/auth/login');
    }
  };

  return (
    <header className="relative z-[99] h-14 bg-gradient-to-r from-blue-50 via-white to-white flex items-center justify-between pr-4 border-b border-gray-200">
      {/* Breadcrumb */}
      <div className="flex items-center ml-8">
        <Breadcrumb />
      </div>

      {/* User Profile */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 text-sm hover:bg-gray-50 rounded-full p-1 transition-colors"
        >
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-xs">
              {userName.charAt(0).toUpperCase()}
            </span>
          </div>
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-medium text-base">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  router.push('/settings');
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>설정</span>
              </button>
              <div className="border-t border-gray-100 my-1" />
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
    </header>
  );
}
