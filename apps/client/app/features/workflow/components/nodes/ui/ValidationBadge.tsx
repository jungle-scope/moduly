import { AlertTriangle } from 'lucide-react';

/**
 * ValidationBadge
 * 
 * 노드 실행 필수 요건을 채우지 못했을 때 canvas 페이지의 노드 프리뷰에서 경고를 표시하는 컴포넌트
 * 
 * 현재는 'warning' 타입만 사용하고 있지만, 향후 확장을 위해 타입 시스템을 설계했습니다.
 * 
 * [확장 가능성]
 * - 'error' 타입 추가 시: 더 강한 시각적 경고 (진한 빨강 테두리/배경)
 * - 'info' 타입 추가 시: 정보성 알림 (파란색 계열)
 * - 'success' 타입 추가 시: 성공 상태 표시 (초록색 계열)
 * 
 * 새로운 타입을 추가하려면:
 * 1. BadgeType에 타입 추가
 * 2. BADGE_STYLES에 해당 타입의 스타일 추가
 * 3. 필요시 아이콘 매핑 추가
 */

// 배지 타입 정의
// TODO: 향후 'error' | 'info' | 'success' 등으로 확장 가능
type BadgeType = 'warning';

// 배지 크기 정의
type BadgeSize = 'xs' | 'sm' | 'md';

interface ValidationBadgeProps {
  /** 표시할 메시지 */
  message: string;
  /** 배지 타입 (현재는 warning만 사용) */
  type?: BadgeType;
  /** 배지 크기 */
  size?: BadgeSize;
  /** 추가 className */
  className?: string;
}

// 타입별 스타일 정의
// 향후 다른 타입 추가 시 여기에 스타일을 추가하면 됩니다
const BADGE_STYLES: Record<BadgeType, {
  container: string;
  text: string;
  icon: string;
}> = {
  warning: {
    container: 'bg-red-50 border border-red-300',
    text: 'text-red-600',
    icon: 'text-red-500',
  },
  // 예시: 향후 추가 가능한 타입들
  // error: {
  //   container: 'bg-red-100 border border-red-500',
  //   text: 'text-red-700',
  //   icon: 'text-red-600',
  // },
  // info: {
  //   container: 'bg-blue-50 border border-blue-300',
  //   text: 'text-blue-600',
  //   icon: 'text-blue-500',
  // },
};

// 크기별 스타일 정의
const SIZE_STYLES: Record<BadgeSize, {
  container: string;
  text: string;
  icon: string;
}> = {
  xs: {
    container: 'px-1.5 py-0.5 rounded',
    text: 'text-[10px]',
    icon: 'w-2.5 h-2.5',
  },
  sm: {
    container: 'px-2 py-1 rounded-md',
    text: 'text-[11px]',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'px-2.5 py-1.5 rounded-lg',
    text: 'text-xs',
    icon: 'w-3.5 h-3.5',
  },
};

/**
 * ValidationBadge 컴포넌트
 * 
 * @example
 * // 기본 사용
 * <ValidationBadge message="확인 필요" />
 * 
 * // 크기 지정
 * <ValidationBadge message="확인 필요" size="sm" />
 * 
 * // 향후 타입 확장 시
 * // <ValidationBadge message="오류 발생" type="error" />
 */
export function ValidationBadge({
  message,
  type = 'warning',
  size = 'sm',
  className = '',
}: ValidationBadgeProps) {
  const typeStyle = BADGE_STYLES[type];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <div
      className={`
        inline-flex items-center gap-1
        ${typeStyle.container}
        ${sizeStyle.container}
        ${className}
      `}
    >
      <AlertTriangle className={`${typeStyle.icon} ${sizeStyle.icon}`} />
      <span className={`${typeStyle.text} ${sizeStyle.text} font-medium`}>
        {message}
      </span>
    </div>
  );
}
