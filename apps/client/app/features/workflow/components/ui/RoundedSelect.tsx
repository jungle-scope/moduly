import { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface Option {
  label: string;
  value: string | number;
  disabled?: boolean;
}

interface RoundedSelectProps {
  value: string | number;
  onChange: (value: string | any) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string; // Trigger button className override
}

/**
 * RoundedSelect
 *
 * ModelSelectDropdown과 유사한 디자인 (rounded-lg 팝업)을 가진 범용 Select 컴포넌트입니다.
 * 기존의 native <select>를 대체하기 위해 사용합니다.
 */
export function RoundedSelect({
  value,
  onChange,
  options,
  placeholder = '선택하세요',
  disabled = false,
  className = '',
}: RoundedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 선택된 옵션 찾기
  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value],
  );

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm transition-all focus:outline-none ${
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
            : `border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                isOpen ? 'border-blue-500 ring-1 ring-blue-500' : ''
              }`
        } ${className}`}
      >
        <span
          className={`truncate ${!selectedOption ? 'text-gray-400' : 'text-gray-700'}`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 드롭다운 팝오버 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 min-w-full w-auto bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            {options.length > 0 ? (
              options.map((option) => {
                const isSelected = String(option.value) === String(value);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                    className={`min-w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors whitespace-nowrap ${
                      option.disabled
                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                        : isSelected
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-4" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">
                옵션이 없습니다.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
