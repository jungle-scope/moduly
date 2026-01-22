import { memo } from 'react';
import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ValidationBadgeProps {
  message?: string;
  className?: string;
}

export const ValidationBadge = memo(
  ({ message = '확인 필요', className }: ValidationBadgeProps) => {
    return (
      <div className={cn('mt-2 w-full', className)}>
        <div className="w-full flex items-center justify-center bg-red-50 rounded-md px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mr-1.5" />
          <span className="text-xs font-medium text-red-600">{message}</span>
        </div>
      </div>
    );
  },
);

ValidationBadge.displayName = 'ValidationBadge';
