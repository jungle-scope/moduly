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
        {/* 아이콘은 필요시 props로 받거나 여기서 분기 처리 가능하지만, 
            기존에 일관되게 이모지(⚠️)를 쓰고 있어서 일단 텍스트에 포함된 것으로 가정하거나 
            여기서 강제할 수도 있습니다. 
            일단 기존 코드들이 텍스트 안에 ⚠️를 포함하고 있으므로 그대로 둡니다. */}
        {message}
      </p>
    </div>
  );
}
