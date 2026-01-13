'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
}

export default function Breadcrumb() {
  const pathname = usePathname();
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    const generateBreadcrumbs = () => {
      const pathMap: Record<string, string> = {
        '/dashboard': '홈',
        '/dashboard/mymodule': '내 모듈',
        '/dashboard/explore': '마켓플레이스',
        '/dashboard/statistics': '통계',
        '/dashboard/knowledge': '지식 관리',
        '/dashboard/settings': '설정',
        '/modules': '모듈',
      };

      // Exact match
      if (pathMap[pathname]) {
        setBreadcrumbs([{ label: pathMap[pathname], href: pathname }]);
        return;
      }

      // Dynamic routes
      const segments = pathname.split('/').filter(Boolean);
      const items: BreadcrumbItem[] = [];

      // Always start with home
      items.push({ label: '홈', href: '/dashboard' });

      // Handle /modules/[id] routes
      if (segments[0] === 'modules' && segments.length > 1) {
        items.push({ label: '내 모듈', href: '/dashboard/mymodule' });
        // TODO: Fetch module name from API
        items.push({ label: '편집', href: pathname });
      }
      // Handle /dashboard/explore/[id] routes
      else if (
        segments[0] === 'dashboard' &&
        segments[1] === 'explore' &&
        segments.length > 2
      ) {
        items.push({ label: '마켓플레이스', href: '/dashboard/explore' });
        // TODO: Fetch app name from API
        items.push({ label: '상세', href: pathname });
      }
      // Handle other dashboard routes
      else if (segments[0] === 'dashboard' && segments.length > 1) {
        const route = `/${segments.slice(0, 2).join('/')}`;
        if (pathMap[route]) {
          items.push({ label: pathMap[route], href: route });
        }
      }

      setBreadcrumbs(items);
    };

    generateBreadcrumbs();
  }, [pathname]);

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 text-sm">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={item.href} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
            {isLast ? (
              <span className="text-gray-900 font-medium">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
