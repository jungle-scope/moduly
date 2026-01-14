import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ValidationAlertProps {
  message: ReactNode;
  type?: 'error' | 'warning';
  className?: string;
}

export function ValidationAlert({
  message,
  type = 'error',
  className,
}: ValidationAlertProps) {
  const isError = type === 'error';
  const bgColor = isError ? 'bg-red-50' : 'bg-orange-50';
  const borderColor = isError ? 'border-red-200' : 'border-orange-200';
  const textColor = isError ? 'text-red-700' : 'text-orange-700';

  return (
    <div
      className={cn(
        `${bgColor} border ${borderColor} rounded p-2 ${textColor} text-xs mt-1`,
        className
      )}
    >
      <p className="font-semibold flex items-center gap-1">
        {message}
      </p>
    </div>
  );
}
