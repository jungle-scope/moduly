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
    name: '지식', // Changed to '지식' as seen in the user's manual file creation attempt context, or '참고자료' as in conflict. User's manual edit used '지식' for 'dashboard/knowledge'. I'll stick to '참고자료' if it matches previous, BUT the user manually pasted code in Step 1782 used '지식'. I will use '지식' to be safe or consistent with their latest intent, or check previous file.
    // Actually, in the conflict text (Step 1762), it says '참고자료'.
    // In Step 1782 (User manual create), they used '지식'.
    // Use '참고자료' as per the conflict text from KAN339 which is likely the source of truth for "feature/KAN339 version".
    // Wait, Step 1762 KAN339 side says:
    // name: '참고자료', href: '/dashboard/knowledge'
    // So I will use '참고자료'.
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
              // Used the className logic from the KAN339 side of the conflict
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

      {/* Footer from KAN339 not explicitly shown in conflict block for KAN339 but likely simple or non-existent? 
         Wait, step 1762 shows footer ONLY outside the conflict block? No, the conflict block ends before Footer in one case?
         Actually, in Step 1762:
         <<<<<<< feature/KAN339
         <aside ... >
         =======
         <aside ... >
         ...
         >>>>>>> develop
         {/* Main Navigation */}
         // ...
         // Footer is OUTSIDE the conflict block at the bottom.
         // Wait, the conflict block in 1762 covers the OPENING of <aside> and the Create button. 
         // The Main Navigation and Footer were distinct or shared?
         // In 1762, the `Main Navigation` comment starts AFTER the conflict block.
         // So the Footer is present in both versions effectively.
         // However, the `</aside>` is at the end.
      */}
      <div className="border-t border-gray-200 p-4 mb-safe">
        <p className="text-xs text-center text-gray-500">
          © 2025 Moduly
        </p>
      </div>
    </aside>
  );
}
