'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  bgColor?: 'amber' | 'gray';
  children: React.ReactNode;
}

const colorClasses = {
  amber: 'bg-amber-50 border-amber-200',
  gray: 'bg-gray-50 border-gray-200',
};

const headerColorClasses = {
  amber: 'text-amber-700',
  gray: 'text-gray-700',
};

/**
 * 접기/펼치기가 가능한 섹션 컴포넌트
 */
export const CollapsibleSection = ({
  title,
  icon,
  defaultOpen = true,
  bgColor = 'gray',
  children,
}: CollapsibleSectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-lg border ${colorClasses[bgColor]}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-opacity-80 transition-all"
      >
        <div className="flex items-center gap-2">
          {icon}
          <h4 className={`font-semibold text-sm ${headerColorClasses[bgColor]}`}>
            {title}
          </h4>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${headerColorClasses[bgColor]} ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
};
