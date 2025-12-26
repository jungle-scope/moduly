import React from 'react';
import { AppIconSelection } from './types';
import { twMerge } from 'tailwind-merge';

type Props = {
  icon: AppIconSelection; // 표시할 아이콘 데이터 (이모지 + 배경색)
  onClick?: () => void; // 클릭 시 동작 (옵션)
  className?: string; // 추가 스타일링 클래스
  size?: 'sm' | 'md' | 'lg'; // 아이콘 크기 (기본값: 'md')
};

/**
 * 앱 아이콘 표시 컴포넌트
 *
 * 이모지와 배경색을 받아 둥근 사각형 형태의 아이콘을 렌더링합니다.
 */
export const AppIcon = ({ icon, onClick, className, size = 'md' }: Props) => {
  // 사이즈별 클래스 정의
  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-10 h-10 text-xl',
    lg: 'w-12 h-12 text-2xl',
  };

  return (
    <div
      onClick={onClick}
      className={twMerge(
        'flex items-center justify-center rounded-lg cursor-pointer transition-opacity hover:opacity-80 select-none',
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: icon.bg }}
    >
      {icon.emoji}
    </div>
  );
};
