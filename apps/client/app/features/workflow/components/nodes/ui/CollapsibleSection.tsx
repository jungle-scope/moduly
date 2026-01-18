import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string | React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  icon?: React.ReactNode | ((expand: () => void) => React.ReactNode);
  showDivider?: boolean; // 섹션 하단 구분선 표시 여부
}

/**
 * CollapsibleSection
 * 아코디언 스타일의 접이식 섹션 컴포넌트
 * 기존의 박스형 레이아웃을 대체합니다.
 */
export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  className = '',
  icon,
  showDivider = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`py-2 ${className}`}>
      {/* Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer select-none py-1.5 hover:bg-gray-50 rounded px-2 -mx-2 bg-transparent transition-colors group"
      >
        <div className="flex items-center gap-2">
          <div className="text-gray-500 transition-transform duration-200">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>

        {icon && (
          <div
            className="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
          >
            {typeof icon === 'function' ? icon(() => setIsOpen(true)) : icon}
          </div>
        )}
      </div>

      {/* Content */}
      {isOpen && (
        <div className="mt-2 pl-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}

      {/* Divider */}
      {showDivider && <div className="mt-3 border-b border-gray-200" />}
    </div>
  );
}
